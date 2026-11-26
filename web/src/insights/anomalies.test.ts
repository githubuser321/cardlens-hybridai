import { describe, expect, it } from 'vitest';
import { detectAnomalies } from './anomalies';

function row(
  date: string,
  merchant: string,
  amount: number,
  category = 'shopping',
  currency = 'ILS',
) {
  return { date, merchant, amount, category, currency };
}

describe('detectAnomalies', () => {
  it('flags a charge that dwarfs the merchant history', () => {
    const anomalies = detectAnomalies([
      row('2026-01-02', 'אל על', 80, 'travel'),
      row('2026-02-02', 'אל על', 95, 'travel'),
      row('2026-03-18', 'אל על', 640, 'travel'),
    ]);
    expect(anomalies.map((anomaly) => [anomaly.kind, anomaly.index])).toEqual([['large', 2]]);
    expect(anomalies[0]?.reason).toMatch(/unusually large/);
  });

  it('flags a category outlier when the merchant has no history', () => {
    const anomalies = detectAnomalies([
      row('2026-01-02', 'Cafe One', 30, 'dining'),
      row('2026-01-03', 'Cafe Two', 28, 'dining'),
      row('2026-01-04', 'Cafe Three', 32, 'dining'),
      row('2026-01-20', 'Banquet Hall', 400, 'dining'),
    ]);
    expect(anomalies.some((anomaly) => anomaly.kind === 'large' && anomaly.merchant === 'Banquet Hall')).toBe(true);
  });

  it('flags same-merchant same-amount charges inside three days and not beyond that', () => {
    const close = detectAnomalies([
      row('2026-02-08', 'GETT', 36, 'transport'),
      row('2026-02-09', 'GETT', 36, 'transport'),
    ]);
    expect(close.filter((anomaly) => anomaly.kind === 'duplicate')).toHaveLength(2);

    const far = detectAnomalies([
      row('2026-02-01', 'GETT', 36, 'transport'),
      row('2026-02-05', 'GETT', 36, 'transport'),
    ]);
    expect(far.some((anomaly) => anomaly.kind === 'duplicate')).toBe(false);
  });

  it('flags merchants that first appear in the latest month of a multi-month statement', () => {
    const anomalies = detectAnomalies([
      row('2026-01-05', 'NETFLIX.COM', 54.9, 'subscriptions'),
      row('2026-02-05', 'NETFLIX.COM', 54.9, 'subscriptions'),
      row('2026-02-11', 'עמלת כרטיס', 15, 'fees'),
    ]);
    const newcomers = anomalies.filter((anomaly) => anomaly.kind === 'new_merchant');
    expect(newcomers.map((anomaly) => anomaly.merchant)).toEqual(['עמלת כרטיס']);

    const oneMonth = detectAnomalies([
      row('2026-03-01', 'IKEA', 400),
      row('2026-03-02', 'NETFLIX.COM', 54.9, 'subscriptions'),
    ]);
    expect(oneMonth.some((anomaly) => anomaly.kind === 'new_merchant')).toBe(false);
  });

  it('flags foreign currency against the dominant currency, and fees', () => {
    const anomalies = detectAnomalies([
      row('2026-03-01', 'שופרסל', 40, 'groceries', 'ILS'),
      row('2026-03-02', 'רמי לוי', 20, 'groceries', 'ILS'),
      row('2026-03-07', 'LUMEN BOOKS', 42.5, 'other', 'EUR'),
      row('2026-03-11', 'עמלת כרטיס', 15, 'fees', 'ILS'),
    ]);
    expect(anomalies.some((anomaly) => anomaly.kind === 'foreign_currency' && anomaly.currency === 'EUR')).toBe(true);
    expect(anomalies.some((anomaly) => anomaly.kind === 'foreign_currency' && anomaly.currency === 'ILS')).toBe(false);
    expect(anomalies.filter((anomaly) => anomaly.kind === 'fee').map((anomaly) => anomaly.merchant)).toEqual(['עמלת כרטיס']);
  });

  it('does not treat a normal repeat purchase as large', () => {
    const anomalies = detectAnomalies([
      row('2026-01-09', 'חברת חשמל', 302.1, 'utilities'),
      row('2026-02-09', 'חברת חשמל', 298.4, 'utilities'),
      row('2026-03-09', 'חברת חשמל', 310.15, 'utilities'),
    ]);
    expect(anomalies.some((anomaly) => anomaly.kind === 'large')).toBe(false);
  });
});
