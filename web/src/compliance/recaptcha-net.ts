export const RECAPTCHA_NET_ENTERPRISE = 'https://www.recaptcha.net/recaptcha/enterprise.js';

const GOOGLE_ENTERPRISE = 'https://www.google.com/recaptcha/enterprise.js';
const GOOGLE_API = 'https://www.google.com/recaptcha/api.js';
const NET_API = 'https://www.recaptcha.net/recaptcha/api.js';

/** Rewrites the Firebase App Check script URL onto www.recaptcha.net. */
export function rewriteRecaptchaUrl(url: string): string {
  if (url.startsWith(GOOGLE_ENTERPRISE)) {
    return RECAPTCHA_NET_ENTERPRISE + url.slice(GOOGLE_ENTERPRISE.length);
  }
  if (url.startsWith(GOOGLE_API)) {
    return NET_API + url.slice(GOOGLE_API.length);
  }
  return url;
}

type ScriptPrototype = {
  src: string;
  __cardlensRecaptchaNet?: boolean;
};

/**
 * The Firebase SDK assigns `script.src` to www.google.com. This setter rewrite
 * sends that assignment to www.recaptcha.net instead. Idempotent.
 */
export function installRecaptchaNetRewrite(scope: typeof globalThis = globalThis): void {
  const proto = scope.HTMLScriptElement?.prototype as ScriptPrototype | undefined;
  if (!proto || proto.__cardlensRecaptchaNet) {
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'src');
  if (!descriptor?.set || !descriptor.get) {
    return;
  }
  const { get, set } = descriptor;
  Object.defineProperty(proto, 'src', {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    get() {
      return get.call(this);
    },
    set(value: string) {
      set.call(this, rewriteRecaptchaUrl(String(value)));
    },
  });
  proto.__cardlensRecaptchaNet = true;
}

/** Load the enterprise script from recaptcha.net before App Check initializes. */
export function preloadRecaptchaNet(doc: Document): Promise<void> {
  const existing = doc.querySelector('script[data-cardlens-recaptcha="net"]');
  if (existing) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const script = doc.createElement('script');
    script.dataset.cardlensRecaptcha = 'net';
    script.async = true;
    script.src = `${RECAPTCHA_NET_ENTERPRISE}?render=explicit`;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    doc.head.append(script);
  });
}
