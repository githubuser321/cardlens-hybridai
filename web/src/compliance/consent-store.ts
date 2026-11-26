import { CONSENT_TEXT_VERSION, type ConsentKind } from './copy';
import { CONSENT_STORAGE_KEY, SESSION_CONSENT_KEY } from './storage-inventory';

export type CloudPreference = 'ask' | 'never';
export type SessionCloud = 'unset' | 'granted' | 'off';
export type ConsentDecision = 'granted' | 'declined';

export interface ConsentRecord {
  kind: ConsentKind;
  decision: ConsentDecision;
  at: string;
  textVersion: string;
  locale: 'en' | 'he';
}

export interface StoredConsent {
  preference: CloudPreference;
  records: ConsentRecord[];
}

export interface SessionConsent {
  text: SessionCloud;
}

export const EMPTY_CONSENT: StoredConsent = {
  preference: 'ask',
  records: [],
};

export const EMPTY_SESSION: SessionConsent = { text: 'unset' };

const MAX_RECORDS = 20;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readConsent(store: StorageLike | null): StoredConsent {
  if (!store) {
    return { ...EMPTY_CONSENT, records: [] };
  }
  try {
    const parsed = JSON.parse(store.getItem(CONSENT_STORAGE_KEY) ?? '') as Partial<StoredConsent> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...EMPTY_CONSENT, records: [] };
    }
    const preference: CloudPreference = parsed.preference === 'never' ? 'never' : 'ask';
    const records = Array.isArray(parsed.records) ? parsed.records.filter(isRecord).slice(-MAX_RECORDS) : [];
    return { preference, records };
  } catch {
    return { ...EMPTY_CONSENT, records: [] };
  }
}

export function writeConsent(store: StorageLike | null, consent: StoredConsent): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      preference: consent.preference,
      records: consent.records.slice(-MAX_RECORDS),
    }));
  } catch {
    // Private mode and quota failures leave the in-memory choice as-is.
  }
}

export function readSessionConsent(store: StorageLike | null): SessionConsent {
  if (!store) {
    return { ...EMPTY_SESSION };
  }
  try {
    const parsed = JSON.parse(store.getItem(SESSION_CONSENT_KEY) ?? '') as Partial<SessionConsent> | null;
    const text = parsed?.text;
    if (text === 'granted' || text === 'off') {
      return { text };
    }
    return { ...EMPTY_SESSION };
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export function writeSessionConsent(store: StorageLike | null, session: SessionConsent): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(SESSION_CONSENT_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota failures.
  }
}

export function recordConsentChoice(
  consent: StoredConsent,
  input: {
    kind: ConsentKind;
    decision: ConsentDecision;
    at: string;
    locale: 'en' | 'he';
    textVersion?: string;
  },
): StoredConsent {
  const next: ConsentRecord = {
    kind: input.kind,
    decision: input.decision,
    at: input.at,
    textVersion: input.textVersion ?? CONSENT_TEXT_VERSION,
    locale: input.locale,
  };
  return {
    preference: consent.preference,
    records: [...consent.records, next].slice(-MAX_RECORDS),
  };
}

/**
 * Whether a redacted text call may go to the cloud without showing the dialog again.
 * Image consent is never remembered here. It is asked every time.
 */
export function textCloudPermission(consent: StoredConsent, session: SessionConsent): 'ask' | 'allow' | 'deny' {
  if (consent.preference === 'never' || session.text === 'off') {
    return 'deny';
  }
  if (session.text === 'granted') {
    return 'allow';
  }
  return 'ask';
}

export function latestRecord(consent: StoredConsent, kind: ConsentKind): ConsentRecord | null {
  for (let index = consent.records.length - 1; index >= 0; index -= 1) {
    const record = consent.records[index];
    if (record?.kind === kind) {
      return record;
    }
  }
  return null;
}

function isRecord(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<ConsentRecord>;
  return (record.kind === 'cloud-text' || record.kind === 'cloud-image')
    && (record.decision === 'granted' || record.decision === 'declined')
    && typeof record.at === 'string'
    && typeof record.textVersion === 'string'
    && (record.locale === 'en' || record.locale === 'he');
}
