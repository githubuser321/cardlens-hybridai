import { describe, expect, it } from 'vitest';
import { detectSubscriptions, monthlyCostByCurrency } from './subscriptions';

const netflix = (date: string, amount = 54.9) => ({
  date,
  merchant: 'NETFLIX.COM',
  amount,
  currency: 'ILS',
});

describe('detectSubscriptions', () => {
  it('marks monthly charges with a stable amount and estimates the monthly cost', () => {
    const found = detectSubscriptions([
      netflix('2025-12-05'),
      netflix('2026-02-05', 54.9),
      { date: '2026-01-05', merchant: 'Netflix.com', amount: 55.4, currency: 'ILS' },
      { date: '2026-01-02', merchant: 'שופרסל', amount: 40, currency: 'ILS' },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      merchant: 'NETFLIX.COM',
      cadence: 'monthly',
      currency: 'ILS',
      occurrenceCount: 3,
      monthlyCost: 54.9,
    });
    expect(found[0]?.transactionIndexes).toEqual([0, 2, 1]);
  });

  it('converts an annual charge into a monthly estimate', () => {
    const found = detectSubscriptions([
      { date: '2025-03-01', merchant: 'NORTHWIND INSURANCE', amount: 480, currency: 'ILS' },
      { date: '2026-03-01', merchant: 'Northwind Insurance', amount: 480, currency: 'ILS' },
    ]);
    expect(found[0]).toMatchObject({ cadence: 'annual', monthlyCost: 40, occurrenceCount: 2 });
    expect(monthlyCostByCurrency(found)).toEqual([{ currency: 'ILS', total: 40 }]);
  });

  it('rejects irregular gaps, drifting amounts, weekly charges, and single charges', () => {
    expect(detectSubscriptions([
      netflix('2026-01-05'),
      netflix('2026-02-05'),
    ])).toEqual([]);
    expect(detectSubscriptions([
      netflix('2026-01-01', 100),
      netflix('2026-02-01', 180),
      netflix('2026-03-01', 90),
    ])).toEqual([]);
    expect(detectSubscriptions([
      netflix('2026-01-01', 20),
      netflix('2026-01-08', 20),
      netflix('2026-01-15', 20),
    ])).toEqual([]);
    expect(detectSubscriptions([
      netflix('2026-01-05', 100),
      netflix('2026-02-05', 116),
      netflix('2026-03-05', 100),
    ])).toEqual([]);
    expect(detectSubscriptions([netflix('2026-03-05')])).toEqual([]);
  });

  it('keeps currencies separate and ignores refunds', () => {
    const found = detectSubscriptions([
      { date: '2025-12-01', merchant: 'SPOTIFY', amount: 19.9, currency: 'ILS' },
      { date: '2026-01-01', merchant: 'SPOTIFY', amount: 19.9, currency: 'ILS' },
      { date: '2026-02-01', merchant: 'SPOTIFY', amount: 19.9, currency: 'ILS' },
      { date: '2025-12-01', merchant: 'SPOTIFY', amount: 9.99, currency: 'USD' },
      { date: '2026-01-01', merchant: 'SPOTIFY', amount: 9.99, currency: 'USD' },
      { date: '2026-02-01', merchant: 'SPOTIFY', amount: 9.99, currency: 'USD' },
      { date: '2026-02-15', merchant: 'SPOTIFY', amount: -19.9, currency: 'ILS' },
    ]);
    expect(found.map((row) => row.currency).sort()).toEqual(['ILS', 'USD']);
    expect(found.every((row) => row.occurrenceCount === 3)).toBe(true);
  });

  it('accepts a 15 percent amount band and a one-unit difference', () => {
    expect(detectSubscriptions([
      netflix('2026-01-05', 100),
      netflix('2026-02-05', 115),
      netflix('2026-03-05', 100),
    ])).toHaveLength(1);
    expect(detectSubscriptions([
      netflix('2026-01-05', 5),
      netflix('2026-02-05', 5.8),
      netflix('2026-03-05', 5),
    ])).toHaveLength(1);
  });
});
