type DebugTokenHost = {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
};

/**
 * Install the App Check debug token.
 * An empty token becomes `true`, which makes the SDK print a token to register.
 * Production code must not call this. The firebase module only calls it from `import.meta.env.DEV`.
 */
export function applyAppCheckDebugToken(
  isDev: boolean,
  debugToken: string | undefined,
  target: DebugTokenHost | undefined = devDebugTarget(),
): void {
  if (!isDev || !target) {
    return;
  }
  const configured = typeof debugToken === 'string' ? debugToken.trim() : '';
  target.FIREBASE_APPCHECK_DEBUG_TOKEN = configured.length > 0 ? configured : true;
}

function devDebugTarget(): DebugTokenHost | undefined {
  if (typeof self === 'undefined') {
    return undefined;
  }
  return self;
}
