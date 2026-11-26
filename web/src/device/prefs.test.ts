import { describe, expect, it } from 'vitest';
import type { DeviceAvailability } from './availability';
import {
  EMPTY_ONBOARDING_PREFS,
  ONBOARDING_PREFS_KEY,
  prefsAfterDismiss,
  readOnboardingPrefs,
  shouldNag,
  writeOnboardingPrefs,
  type KeyValueStore,
} from './prefs';

function memoryStore(initial?: string): KeyValueStore {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(ONBOARDING_PREFS_KEY, initial);
  }
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('onboarding prefs', () => {
  it('nags for a download or an unsupported browser until dismissed', () => {
    const fresh = { ...EMPTY_ONBOARDING_PREFS };
    expect(shouldNag('downloadable', fresh)).toBe(true);
    expect(shouldNag('not-supported', fresh)).toBe(true);
    expect(shouldNag('unknown', fresh)).toBe(true);
    expect(shouldNag('available', fresh)).toBe(false);
    expect(shouldNag('downloadable', prefsAfterDismiss(fresh, 'downloadable'))).toBe(false);
    expect(shouldNag('not-supported', prefsAfterDismiss(fresh, 'not-supported'))).toBe(false);
    expect(shouldNag('downloadable', prefsAfterDismiss(fresh, 'not-supported'))).toBe(true);
  });

  it('round-trips the dismissed state and ignores corrupt storage', () => {
    const store = memoryStore();
    writeOnboardingPrefs(store, {
      dismissed: true,
      acknowledgedUnsupported: false,
      lastAvailability: 'downloadable',
    });
    expect(store.getItem(ONBOARDING_PREFS_KEY)).toContain('downloadable');
    expect(readOnboardingPrefs(store)).toEqual({
      dismissed: true,
      acknowledgedUnsupported: false,
      lastAvailability: 'downloadable',
    });
    expect(readOnboardingPrefs(memoryStore('{'))).toEqual(EMPTY_ONBOARDING_PREFS);
    expect(readOnboardingPrefs(memoryStore('{"lastAvailability":"nope"}'))).toEqual(EMPTY_ONBOARDING_PREFS);
    expect(readOnboardingPrefs(null)).toEqual(EMPTY_ONBOARDING_PREFS);
  });

  it('keeps running when storage throws', () => {
    const store: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readOnboardingPrefs(store)).toEqual(EMPTY_ONBOARDING_PREFS);
    expect(() => writeOnboardingPrefs(store, {
      dismissed: true,
      acknowledgedUnsupported: true,
      lastAvailability: 'not-supported' satisfies DeviceAvailability,
    })).not.toThrow();
  });
});
