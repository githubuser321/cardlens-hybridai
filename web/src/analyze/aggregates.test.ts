import { describe, expect, it } from 'vitest';
import { aggregateTransactions } from './aggregates';

describe('aggregateTransactions', () => {
  it('sums refunds into the category and does not mix currencies', () => {
    const result = aggregateTransactions([
      { date: '2026-02-01', merchant: 'Shop', amount: 100, currency: 'ILS', category: 'shopping' },
      { date: '2026-02-20', merchant: 'Shop', amount: -40, currency: 'ILS', category: 'shopping' },
      { date: '2026-03-02', merchant: 'Market', amount: 10, currency: 'ILS', category: 'groceries' },
      { date: '2026-03-03', merchant: 'Stream', amount: 5, currency: 'USD', category: 'subscriptions' },
    ]);
    expect(result.transactionCount).toBe(4);
    expect(result.categoryTotals).toEqual([
      { category: 'shopping', currency: 'ILS', total: 60, count: 2 },
      { category: 'groceries', currency: 'ILS', total: 10, count: 1 },
      { category: 'subscriptions', currency: 'USD', total: 5, count: 1 },
    ]);
    expect(result.currencyTotals).toEqual([
      { currency: 'ILS', total: 70, count: 3 },
      { currency: 'USD', total: 5, count: 1 },
    ]);
    expect(result.monthTotals.map((row) => [row.month, row.currency, row.total])).toEqual([
      ['2026-02', 'ILS', 60],
      ['2026-03', 'ILS', 10],
      ['2026-03', 'USD', 5],
    ]);
    expect(result.topMerchants[0]).toMatchObject({ merchant: 'Shop', total: 60 });
  });

  it('returns an empty aggregate for no rows', () => {
    const result = aggregateTransactions([]);
    expect(result.transactionCount).toBe(0);
    expect(result.currencyTotals).toEqual([]);
    expect(result.topMerchants).toEqual([]);
  });
});
