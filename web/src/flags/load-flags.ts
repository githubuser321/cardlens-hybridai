import type { FirebaseApp } from 'firebase/app';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { flagsFromStrings, LOCAL_FLAG_DEFAULTS, type FeatureFlags } from './flags';

export const REMOTE_FLAG_KEYS = {
  monthComparison: 'month_comparison_enabled',
  notableDeltaPercent: 'notable_delta_percent',
  /** Kill switch. No personal data. Do not enable Remote Config personalization. */
  cloudFallback: 'cloud_fallback_enabled',
} as const;

export async function loadFeatureFlags(
  readRemote: () => Promise<{ monthComparison?: string; notableDeltaPercent?: string } | null>,
): Promise<FeatureFlags> {
  try {
    const remote = await readRemote();
    if (!remote) {
      return { ...LOCAL_FLAG_DEFAULTS };
    }
    return flagsFromStrings(remote);
  } catch {
    return { ...LOCAL_FLAG_DEFAULTS };
  }
}

/**
 * Remote Config is a free Spark client. Fetch failure keeps `defaultConfig`,
 * and a thrown fetch is turned into the same local defaults by `loadFeatureFlags`.
 */
export async function readRemoteFlagValues(
  app: FirebaseApp | null,
): Promise<{ monthComparison?: string; notableDeltaPercent?: string; cloudFallback?: string } | null> {
  if (!app) {
    return null;
  }
  const remote = getRemoteConfig(app);
  remote.defaultConfig = {
    [REMOTE_FLAG_KEYS.monthComparison]: LOCAL_FLAG_DEFAULTS.monthComparisonEnabled ? 'true' : 'false',
    [REMOTE_FLAG_KEYS.notableDeltaPercent]: String(LOCAL_FLAG_DEFAULTS.notableDeltaPercent),
    // In-app default if the server has no value yet. The client region check can still force this off.
    [REMOTE_FLAG_KEYS.cloudFallback]: 'true',
  };
  remote.settings = {
    minimumFetchIntervalMillis: 5 * 60 * 1000,
    fetchTimeoutMillis: 4000,
  };
  await fetchAndActivate(remote);
  return {
    monthComparison: getValue(remote, REMOTE_FLAG_KEYS.monthComparison).asString(),
    notableDeltaPercent: getValue(remote, REMOTE_FLAG_KEYS.notableDeltaPercent).asString(),
    cloudFallback: getValue(remote, REMOTE_FLAG_KEYS.cloudFallback).asString(),
  };
}
