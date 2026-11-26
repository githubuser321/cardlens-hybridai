/** When an AI instance was constructed relative to App Check on that same Firebase app. */
export type AiAppCheckBinding = 'before-app-check' | 'after-app-check';

/**
 * Hybrid generateContent may use only an AI instance created after App Check exists.
 * @firebase/ai copies app-check-internal once inside the AIService constructor
 * (`getImmediate({ optional: true })`) and never updates it. A null copy means
 * generateContent does not call getLimitedUseToken and sends no App Check header.
 */
export function hybridAiAllowed(binding: AiAppCheckBinding): boolean {
  return binding === 'after-app-check';
}

/** How many token reads to try before refusing the first cloud model call. */
export const APP_CHECK_TOKEN_ATTEMPTS = 3;

const LEAD = 'App Check did not return a usable token, so the cloud model was not called.';
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/**
 * Firebase fills a failed exchange with a non-JWT error blob.
 * A usable token is a three-segment JWT whose payload is not that error.
 */
export function isUsableAppCheckToken(token: string | null | undefined): boolean {
  if (typeof token !== 'string') {
    return false;
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return false;
  }
  const payload = decodeBase64Url(parts[1] ?? '');
  if (payload == null) {
    return false;
  }
  return !payload.includes('"error"');
}

let cloudWarnUsed = false;

/** One console warning for each cloud send. */
export function resetCloudWarn(): void {
  cloudWarnUsed = false;
}

/** Logs the failure name and code. Token text is removed. */
export function warnCloudFailure(error: unknown): void {
  if (cloudWarnUsed) {
    return;
  }
  cloudWarnUsed = true;
  const name = error instanceof Error ? error.name.replace(/[^\w]/g, '').slice(0, 40) : 'Error';
  const code = readErrorCode(error);
  const message = (error instanceof Error ? error.message : 'Cloud AI did not finish.')
    .replace(JWT_PATTERN, '[token]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const head = [name, code].filter(Boolean).join(' ');
  console.warn(`CardLens cloud send: ${head}${message ? ` — ${message}` : ''}`);
}

function readErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return '';
  }
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code.replace(/[^a-z0-9/_-]/gi, '').slice(0, 80) : '';
}

/** English failure text. Token material is removed before it can reach the UI. */
export function cloudAppCheckFailureMessage(cause: unknown): string {
  if (!(cause instanceof Error)) {
    return LEAD;
  }
  const detail = cause.message.replace(JWT_PATTERN, '[token]').replace(/\s+/g, ' ').trim();
  if (!detail || detail.length > 240) {
    return LEAD;
  }
  const code = readErrorCode(cause);
  const withCode = code && !detail.includes(code) ? `${detail} (${code})` : detail;
  return `${LEAD} ${withCode}`;
}

function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    return atob(base64 + pad);
  } catch {
    return null;
  }
}
