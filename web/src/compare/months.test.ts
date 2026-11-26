import { describe, expect, it } from 'vitest';
import type { Subscription } from '../insights/subscriptions';
import { compareMonths, formatDeltaPercent } from './months';

function subscription(overrides: Partial<Subscription> & Pick<Subscription, 'merchant' | 'transactionIndexes'>): Subscription {
  return {
    normalizedMerchant: overrides.merchant.toLowerCase(),
    cadence: 'monthly',
    currency: 'ILS',
    occurrenceCount: overrides.transactionIndexes.length,
    monthlyCost: 50,
    ...overrides,
  };
}

describe('compareMonths', () => {
  const transactions = [
    { date: '2026-01-05', merchant: 'NETFLIX.COM', amount: 50, currency: 'ILS', category: 'subscriptions' },
    { date: '2026-02-05', merchant: 'NETFLIX.COM', amount: 50, currency: 'ILS', category: 'subscriptions' },
    { date: '2026-01-09', merchant: 'שופרסל', amount: 100, currency: 'ILS', category: 'groceries' },
    { date: '2026-02-09', merchant: 'שופרסל', amount: 150, currency: 'ILS', category: 'groceries' },
    { date: '2026-02-11', merchant: 'New Gym', amount: 80, currency: 'ILS', category: 'health' },
    { date: '2026-01-02', merchant: 'Old Mag', amount: 20, currency: 'USD', category: 'shopping' },
    { date: '2026-01-20', merchant: 'Refund Co', amount: -10, currency: 'ILS', category: 'shopping' },
  ];

  it('returns null until two months exist', () => {
    expect(compareMonths(transactions.slice(0, 1), [])).toBeNull();
    expect(compareMonths([], [])).toBeNull();
  });

  it('computes per-category amount and percent deltas without mixing currencies', () => {
    const comparison = compareMonths(transactions, [
      subscription({ merchant: 'NETFLIX.COM', transactionIndexes: [0, 1] }),
      subscription({ merchant: 'New Gym', transactionIndexes: [4], monthlyCost: 80 }),
      subscription({ merchant: 'Old Mag', currency: 'USD', transactionIndexes: [5], monthlyCost: 20 }),
    ]);
    expect(comparison?.previousMonth).toBe('2026-01');
    expect(comparison?.currentMonth).toBe('2026-02');
    expect(comparison?.categoryDeltas.map((row) => [row.category, row.currency, row.deltaAmount, row.deltaPercent, row.notable])).toEqual([
      ['health', 'ILS', 80, null, true],
      ['groceries', 'ILS', 50, 50, true],
      ['shopping', 'USD', -20, -100, true],
      ['shopping', 'ILS', 10, 100, true],
      ['subscriptions', 'ILS', 0, 0, false],
    ]);
    expect(comparison?.subscriptionChanges).toEqual([
      { merchant: 'New Gym', currency: 'ILS', cadence: 'monthly', monthlyCost: 80, change: 'new' },
      { merchant: 'Old Mag', currency: 'USD', cadence: 'monthly', monthlyCost: 20, change: 'stopped' },
    ]);
  });

  it('uses cents and a caller threshold', () => {
    const comparison = compareMonths([
      { date: '2026-01-01', merchant: 'A', amount: 10.005, currency: 'ILS', category: 'other' },
      { date: '2026-02-01', merchant: 'A', amount: 10.004, currency: 'ILS', category: 'other' },
    ], [], 0.1);
    expect(comparison?.categoryDeltas[0]).toMatchObject({
      previousAmount: 10.01,
      currentAmount: 10,
      deltaAmount: -0.01,
    });
    const quiet = compareMonths([
      { date: '2026-03-01', merchant: 'A', amount: 100, currency: 'ILS', category: 'other' },
      { date: '2026-04-01', merchant: 'A', amount: 110, currency: 'ILS', category: 'other' },
    ], [], 25);
    expect(quiet?.categoryDeltas[0]?.notable).toBe(false);
    expect(formatDeltaPercent(null, 80)).toBe('New');
    expect(formatDeltaPercent(12.5, 10)).toBe('+12.5%');
    expect(formatDeltaPercent(-100, -20)).toBe('-100%');
  });

  it('ignores an earlier month when a later pair exists', () => {
    const comparison = compareMonths([
      { date: '2025-12-01', merchant: 'A', amount: 5, currency: 'ILS', category: 'dining' },
      { date: '2026-01-01', merchant: 'A', amount: 10, currency: 'ILS', category: 'dining' },
      { date: '2026-02-01', merchant: 'A', amount: 30, currency: 'ILS', category: 'dining' },
    ], []);
    expect(comparison?.previousMonth).toBe('2026-01');
    expect(comparison?.categoryDeltas[0]).toMatchObject({ previousAmount: 10, currentAmount: 30, deltaAmount: 20 });
  });
});
