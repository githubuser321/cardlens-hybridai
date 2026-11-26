import { describe, expect, it } from 'vitest';
import { flagsFromStrings, LOCAL_FLAG_DEFAULTS } from './flags';
import { loadFeatureFlags } from './load-flags';

describe('feature flags', () => {
  it('keeps local defaults for empty or unrecognized remote values', () => {
    expect(flagsFromStrings({})).toEqual(LOCAL_FLAG_DEFAULTS);
    expect(flagsFromStrings({ monthComparison: ' ', notableDeltaPercent: 'nope' })).toEqual(LOCAL_FLAG_DEFAULTS);
    expect(flagsFromStrings({ notableDeltaPercent: '-1' }).notableDeltaPercent).toBe(25);
    expect(flagsFromStrings({ notableDeltaPercent: '501' }).notableDeltaPercent).toBe(25);
  });

  it('reads boolean and percent overrides', () => {
    expect(flagsFromStrings({ monthComparison: 'off', notableDeltaPercent: '10' })).toEqual({
      monthComparisonEnabled: false,
      notableDeltaPercent: 10,
    });
    expect(flagsFromStrings({ monthComparison: 'YES' }).monthComparisonEnabled).toBe(true);
  });

  it('falls back to local defaults when Remote Config cannot be read', async () => {
    await expect(loadFeatureFlags(() => Promise.resolve(null))).resolves.toEqual(LOCAL_FLAG_DEFAULTS);
    await expect(loadFeatureFlags(() => Promise.reject(new Error('offline')))).resolves.toEqual(LOCAL_FLAG_DEFAULTS);
    await expect(loadFeatureFlags(() => Promise.resolve({
      monthComparison: 'false',
      notableDeltaPercent: '40',
    }))).resolves.toEqual({
      monthComparisonEnabled: false,
      notableDeltaPercent: 40,
    });
  });
});
