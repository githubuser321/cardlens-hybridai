export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) {
    return upper;
  }
  const lower = sorted[mid - 1] ?? upper;
  return (lower + upper) / 2;
}

/** Whole days from an earlier ISO date to a later one. */
export function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Number.NaN;
  }
  return Math.round((end - start) / 86_400_000);
}
