export type AppCheckInitDecision =
  | { kind: 'recaptcha-enterprise'; siteKey: string }
  | { kind: 'debug-token' }
  | { kind: 'disable-cloud'; message: string };

export const CLOUD_DISABLED_MESSAGE =
  'App Check is not configured, so cloud model calls are off. Set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY to a reCAPTCHA Enterprise site key to allow them. Parsing, keyword rules, subscriptions, anomalies, and month comparison still run on this device, and nothing is sent to the cloud.';

const DEBUG_TOKEN_BANNER =
  'Firebase config loaded. App Check is using the dev debug token because no reCAPTCHA Enterprise site key is set. Cloud calls are allowed in this dev session.';

const RECAPTCHA_BANNER = 'Firebase config loaded from env. App Check uses reCAPTCHA Enterprise.';

/**
 * ReCaptchaEnterpriseProvider is constructed only for `recaptcha-enterprise`.
 * Dev without a site key keeps the debug-token flow. Production with neither
 * disables cloud model calls.
 */
export function decideAppCheckInit(input: {
  siteKey: string | undefined | null;
  isDev: boolean;
}): AppCheckInitDecision {
  const siteKey = typeof input.siteKey === 'string' ? input.siteKey.trim() : '';
  if (siteKey) {
    return { kind: 'recaptcha-enterprise', siteKey };
  }
  if (input.isDev) {
    return { kind: 'debug-token' };
  }
  return { kind: 'disable-cloud', message: CLOUD_DISABLED_MESSAGE };
}

export interface AnalysisBanner {
  tone: 'ok' | 'warning';
  message: string;
}

export interface AnalysisAccess {
  /** Firebase config is present, so ONLY_ON_DEVICE models can be constructed. */
  useOnDevice: boolean;
  /** App Check can be initialized. Region and consent gates still apply before any send. */
  useCloud: boolean;
  block: 'firebase-missing' | 'cloud-disabled' | null;
  banner: AnalysisBanner;
}

export function resolveAnalysisAccess(input: {
  missingFirebase: boolean;
  firebaseNotConfiguredMessage: string;
  decision: AppCheckInitDecision;
}): AnalysisAccess {
  if (input.missingFirebase) {
    return {
      useOnDevice: false,
      useCloud: false,
      block: 'firebase-missing',
      banner: { tone: 'warning', message: input.firebaseNotConfiguredMessage },
    };
  }
  if (input.decision.kind === 'disable-cloud') {
    return {
      useOnDevice: true,
      useCloud: false,
      block: 'cloud-disabled',
      banner: { tone: 'warning', message: input.decision.message },
    };
  }
  if (input.decision.kind === 'debug-token') {
    return {
      useOnDevice: true,
      useCloud: true,
      block: null,
      banner: { tone: 'ok', message: DEBUG_TOKEN_BANNER },
    };
  }
  return {
    useOnDevice: true,
    useCloud: true,
    block: null,
    banner: { tone: 'ok', message: RECAPTCHA_BANNER },
  };
}
