import { FIRST_RUN_STORAGE_KEY } from '../compliance/storage-inventory';

export const FIRST_RUN_KEY = FIRST_RUN_STORAGE_KEY;

export interface LocaleStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FirstRunRecord {
  continuedAt: string;
  textVersion: string;
}

export function readFirstRun(store: LocaleStore | null): FirstRunRecord | null {
  if (!store) {
    return null;
  }
  try {
    const parsed = JSON.parse(store.getItem(FIRST_RUN_KEY) ?? '') as Partial<FirstRunRecord> | null;
    if (!parsed || typeof parsed.continuedAt !== 'string' || typeof parsed.textVersion !== 'string') {
      return null;
    }
    return { continuedAt: parsed.continuedAt, textVersion: parsed.textVersion };
  } catch {
    return null;
  }
}

export function writeFirstRun(store: LocaleStore | null, record: FirstRunRecord): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(FIRST_RUN_KEY, JSON.stringify(record));
  } catch {
    // The notice can show again next visit.
  }
}
