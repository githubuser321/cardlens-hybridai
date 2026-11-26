import { ONBOARDING_STORAGE_KEY } from '../compliance/storage-inventory';
import { isDeviceAvailability, type DeviceAvailability } from './availability';

export const ONBOARDING_PREFS_KEY = ONBOARDING_STORAGE_KEY;

export interface OnboardingPrefs {
  dismissed: boolean;
  acknowledgedUnsupported: boolean;
  lastAvailability: DeviceAvailability | null;
}

export const EMPTY_ONBOARDING_PREFS: OnboardingPrefs = {
  dismissed: false,
  acknowledgedUnsupported: false,
  lastAvailability: null,
};

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Full explanation only until the reader dismisses it. Available never nags. */
export function shouldNag(availability: DeviceAvailability, prefs: OnboardingPrefs): boolean {
  if (availability === 'available') {
    return false;
  }
  if (availability === 'not-supported') {
    return !prefs.acknowledgedUnsupported;
  }
  return !prefs.dismissed;
}

export function prefsAfterDismiss(prefs: OnboardingPrefs, availability: DeviceAvailability): OnboardingPrefs {
  if (availability === 'not-supported') {
    return { ...prefs, acknowledgedUnsupported: true };
  }
  return { ...prefs, dismissed: true };
}

export function readOnboardingPrefs(store: KeyValueStore | null): OnboardingPrefs {
  if (!store) {
    return { ...EMPTY_ONBOARDING_PREFS };
  }
  try {
    const raw = store.getItem(ONBOARDING_PREFS_KEY);
    if (!raw) {
      return { ...EMPTY_ONBOARDING_PREFS };
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingPrefs> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...EMPTY_ONBOARDING_PREFS };
    }
    const last = typeof parsed.lastAvailability === 'string' && isDeviceAvailability(parsed.lastAvailability)
      ? parsed.lastAvailability
      : null;
    return {
      dismissed: parsed.dismissed === true,
      acknowledgedUnsupported: parsed.acknowledgedUnsupported === true,
      lastAvailability: last,
    };
  } catch {
    return { ...EMPTY_ONBOARDING_PREFS };
  }
}

export function writeOnboardingPrefs(store: KeyValueStore | null, prefs: OnboardingPrefs): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(ONBOARDING_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode and quota failures leave the in-memory screen as-is.
  }
}

export function browserPrefsStore(): KeyValueStore | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}
