export interface FeatureFlags {
  monthComparisonEnabled: boolean;
  /** Absolute percent change that earns a Notable badge. */
  notableDeltaPercent: number;
}

export const LOCAL_FLAG_DEFAULTS: FeatureFlags = {
  monthComparisonEnabled: true,
  notableDeltaPercent: 25,
};

const TRUE_WORDS = new Set(['true', '1', 'yes', 'on']);
const FALSE_WORDS = new Set(['false', '0', 'no', 'off']);

/** Remote Config values are strings. Empty or unrecognized values keep the local default. */
export function flagsFromStrings(values: {
  monthComparison?: string | null;
  notableDeltaPercent?: string | null;
}): FeatureFlags {
  return {
    monthComparisonEnabled: parseBool(values.monthComparison, LOCAL_FLAG_DEFAULTS.monthComparisonEnabled),
    notableDeltaPercent: parsePercent(values.notableDeltaPercent, LOCAL_FLAG_DEFAULTS.notableDeltaPercent),
  };
}

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (TRUE_WORDS.has(normalized)) {
    return true;
  }
  if (FALSE_WORDS.has(normalized)) {
    return false;
  }
  return fallback;
}

function parsePercent(value: string | null | undefined, fallback: number): number {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) {
    return fallback;
  }
  return parsed;
}
