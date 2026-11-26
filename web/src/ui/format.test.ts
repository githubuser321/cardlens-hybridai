import { describe, expect, it } from 'vitest';
import { barWidths, filterTransactions, formatCategory, formatMoney, formatMonth, formatStatementDate, formatTimestamp } from './format';

describe('format helpers', () => {
  it('formats money, months, and categories', () => {
    expect(formatMoney(245.9, 'ILS')).toMatch(/245\.90/);
    expect(formatMoney(-89, 'ILS')).toMatch(/89\.00/);
    expect(formatMoney(10, 'US')).toBe('10.00 US');
    expect(formatMonth('2026-02')).toBe('Feb 2026');
    expect(formatCategory('groceries')).toBe('Groceries');
    expect(formatStatementDate('2026-03-01')).toBe('Mar 1, 2026');
    expect(formatTimestamp('2026-11-15T12:00:00.000Z')).not.toContain('T12:00:00.000Z');
  });

  it('scales bars from the largest absolute total', () => {
    expect(barWidths([100, 50, -25])).toEqual([100, 50, 25]);
    expect(barWidths([0, 0])).toEqual([0, 0]);
  });

  it('filters transactions by category', () => {
    const rows = [
      { category: 'fuel' },
      { category: 'dining' },
    ];
    expect(filterTransactions(rows, 'all')).toHaveLength(2);
    expect(filterTransactions(rows, 'fuel')).toEqual([{ category: 'fuel' }]);
  });
});
