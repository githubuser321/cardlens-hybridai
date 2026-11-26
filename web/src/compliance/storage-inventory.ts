/**
 * Every storage key CardLens writes, plus Firebase and Cache Storage names the
 * SDKs create on this origin. Privacy policy §11 is generated from this list.
 * Raw statements and images are not in any of these keys.
 */
export const ONBOARDING_STORAGE_KEY = 'cardlens.device-onboarding.v1';
export const CONSENT_STORAGE_KEY = 'cardlens.consent.v1';
export const SESSION_CONSENT_KEY = 'cardlens.cloud-session.v1';
export const FIRST_RUN_STORAGE_KEY = 'cardlens.first-run.v1';
export const LOCALE_STORAGE_KEY = 'cardlens.locale.v1';

export const LOCAL_STORAGE_KEYS = [
  ONBOARDING_STORAGE_KEY,
  CONSENT_STORAGE_KEY,
  FIRST_RUN_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
] as const;

export const SESSION_STORAGE_KEYS = [SESSION_CONSENT_KEY] as const;

export const INDEXED_DB_NAMES = [
  'firebase-installations-database',
  'firebase-app-check-database',
  'firebase_remote_config',
  'firebase-heartbeat-database',
] as const;

export const CACHE_STORAGE_NAME = 'cardlens-shell-v4';

export const RECAPTCHA_COOKIE_NAME = '_GRECAPTCHA';

export interface StorageInventoryRow {
  name: string;
  where: 'localStorage' | 'sessionStorage' | 'IndexedDB' | 'Cache Storage' | 'cookie';
  setBy: string;
  purpose: string;
  duration: string;
}

export const STORAGE_INVENTORY: readonly StorageInventoryRow[] = [
  {
    name: ONBOARDING_STORAGE_KEY,
    where: 'localStorage',
    setBy: 'CardLens',
    purpose: 'On-device model onboarding (dismissed, last availability). No statement text.',
    duration: 'Until you clear site data or use Clear my data',
  },
  {
    name: CONSENT_STORAGE_KEY,
    where: 'localStorage',
    setBy: 'CardLens',
    purpose: 'Cloud preference (Always ask / Never use cloud) and consent records: timestamp, text version, locale. No statement text.',
    duration: 'Until you clear site data or use Clear my data',
  },
  {
    name: FIRST_RUN_STORAGE_KEY,
    where: 'localStorage',
    setBy: 'CardLens',
    purpose: 'That you continued past the first-run notice, with the text version and time.',
    duration: 'Until you clear site data or use Clear my data',
  },
  {
    name: LOCALE_STORAGE_KEY,
    where: 'localStorage',
    setBy: 'CardLens',
    purpose: 'Earlier language preference, if a previous version saved one. This site is English only.',
    duration: 'Until you clear site data or use Clear my data',
  },
  {
    name: SESSION_CONSENT_KEY,
    where: 'sessionStorage',
    setBy: 'CardLens',
    purpose: 'Whether cloud text fallback is allowed for this tab session. No statement text.',
    duration: 'Until the tab closes, you turn it off, or you clear data',
  },
  {
    name: 'firebase-installations-database',
    where: 'IndexedDB',
    setBy: 'Firebase Installations',
    purpose: 'Firebase installation ID used by Remote Config. Object store firebase-installations-store.',
    duration: 'Until Clear my data, deleteInstallations(), or you clear site data',
  },
  {
    name: 'firebase-app-check-database',
    where: 'IndexedDB',
    setBy: 'Firebase App Check',
    purpose: 'App Check token cache. Created only after you first agree to a cloud call. Object store firebase-app-check-store. Tokens last up to 7 days.',
    duration: 'Until cleared, or the token expires (at most 7 days)',
  },
  {
    name: 'firebase_remote_config',
    where: 'IndexedDB',
    setBy: 'Firebase Remote Config',
    purpose: 'Cached Remote Config template (feature flags and cloud_fallback_enabled). No statement text.',
    duration: 'Until cleared',
  },
  {
    name: 'firebase-heartbeat-database',
    where: 'IndexedDB',
    setBy: 'Firebase',
    purpose: 'SDK heartbeat metadata. Object store firebase-heartbeat-store. No statement text.',
    duration: 'Until cleared',
  },
  {
    name: CACHE_STORAGE_NAME,
    where: 'Cache Storage',
    setBy: 'CardLens service worker',
    purpose: 'App shell so the page can open offline. Older cardlens-shell caches are deleted on activate. Statement files are not intentionally stored; a network-first cache may briefly hold a response for a URL you requested.',
    duration: 'Until the next app update or Clear my data',
  },
  {
    name: RECAPTCHA_COOKIE_NAME,
    where: 'cookie',
    setBy: 'Google reCAPTCHA',
    purpose: 'Necessary risk analysis for App Check. Set on Google’s or recaptcha.net’s domain only after a cloud choice, not by CardLens script as a first-party cookie.',
    duration: 'Set by Google, commonly up to about 6 months. Clear my data cannot delete a cookie on Google’s domain.',
  },
];
