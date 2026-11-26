import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import transactionSchema from '../../../shared/schema/transaction.schema.json';
import { analyzeTransactions } from '../analyze/categorize';
import { toSchemaTransaction } from './schema-transaction';
import { SAMPLE_STATEMENT_LINES } from './sample-statement';
import { parseStatementLines } from './statement';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(transactionSchema);

describe('sample statement', () => {
  it('parses the synthetic fixture, skips totals, and validates every row', async () => {
    const parsed = parseStatementLines(SAMPLE_STATEMENT_LINES);
    expect(parsed.map((row) => [row.date, row.merchant, row.amount, row.currency])).toEqual([
      ['2025-03-01', 'NORTHWIND INSURANCE', 480, 'ILS'],
      ['2025-12-05', 'NETFLIX.COM', 54.9, 'ILS'],
      ['2025-12-20', 'SPOTIFY', 19.9, 'ILS'],
      ['2026-01-02', 'Skyline Hotel', 80, 'ILS'],
      ['2026-01-05', 'NETFLIX.COM', 54.9, 'ILS'],
      ['2026-01-09', 'Partner Telecom', 302.1, 'ILS'],
      ['2026-01-20', 'SPOTIFY', 19.9, 'ILS'],
      ['2026-02-01', 'Harbor Grocery', 245.9, 'ILS'],
      ['2026-02-02', 'Skyline Hotel', 95, 'ILS'],
      ['2026-02-03', 'Market Grocery', 189.4, 'ILS'],
      ['2026-02-05', 'NETFLIX.COM', 54.9, 'ILS'],
      ['2026-02-08', 'GETT', 36, 'ILS'],
      ['2026-02-09', 'GETT', 36, 'ILS'],
      ['2026-02-09', 'Partner Telecom', 298.4, 'ILS'],
      ['2026-02-12', "Harbor Burger", 48, 'ILS'],
      ['2026-02-14', 'Yellow Fuel', 220, 'ILS'],
      ['2026-02-20', 'SPOTIFY', 19.9, 'ILS'],
      ['2026-02-20', 'Amazon Refund', -89, 'ILS'],
      ['2026-03-01', 'NORTHWIND INSURANCE', 480, 'ILS'],
      ['2026-03-02', 'IKEA', 400, 'ILS'],
      ['2026-03-04', 'Corner Pharmacy', 89.9, 'ILS'],
      ['2026-03-06', 'AMAZON.COM', 112.4, 'ILS'],
      ['2026-03-07', 'LUMEN BOOKS', 42.5, 'EUR'],
      ['2026-03-09', 'Partner Telecom', 310.15, 'ILS'],
      ['2026-03-11', 'Card Fee', 15, 'ILS'],
      ['2026-03-15', 'Cinema Lane', 62, 'ILS'],
      ['2026-03-18', 'Skyline Hotel', 640, 'ILS'],
      ['2026-03-22', 'Paybox Transfer', 200, 'ILS'],
      ['2026-03-28', 'UDEMY', 79, 'ILS'],
      ['2026-03-30', 'Transfer Dana Levi', 50, 'ILS'],
    ]);
    expect(parsed.some((row) => row.amount === 9999.99 || row.amount === 120)).toBe(false);
    expect(parsed.find((row) => row.merchant === 'IKEA')?.installments).toEqual({ current: 3, total: 12 });
    expect(parsed.find((row) => row.merchant === 'Corner Pharmacy')?.installments).toEqual({ current: 2, total: 6 });

    const analysis = await analyzeTransactions(parsed, { lines: SAMPLE_STATEMENT_LINES, model: null });
    expect(analysis.sent).toBe(false);
    expect(analysis.transactions.map((row) => [row.merchant, row.category, row.isRecurring, row.inferenceSource])).toEqual([
      ['NORTHWIND INSURANCE', 'insurance', true, 'RULES'],
      ['NETFLIX.COM', 'subscriptions', true, 'RULES'],
      ['SPOTIFY', 'subscriptions', true, 'RULES'],
      ['Skyline Hotel', 'travel', false, 'RULES'],
      ['NETFLIX.COM', 'subscriptions', true, 'RULES'],
      ['Partner Telecom', 'utilities', true, 'RULES'],
      ['SPOTIFY', 'subscriptions', true, 'RULES'],
      ['Harbor Grocery', 'groceries', false, 'RULES'],
      ['Skyline Hotel', 'travel', false, 'RULES'],
      ['Market Grocery', 'groceries', false, 'RULES'],
      ['NETFLIX.COM', 'subscriptions', true, 'RULES'],
      ['GETT', 'transport', false, 'RULES'],
      ['GETT', 'transport', false, 'RULES'],
      ['Partner Telecom', 'utilities', true, 'RULES'],
      ["Harbor Burger", 'dining', false, 'RULES'],
      ['Yellow Fuel', 'fuel', false, 'RULES'],
      ['SPOTIFY', 'subscriptions', true, 'RULES'],
      ['Amazon Refund', 'shopping', false, 'RULES'],
      ['NORTHWIND INSURANCE', 'insurance', true, 'RULES'],
      ['IKEA', 'shopping', true, 'RULES'],
      ['Corner Pharmacy', 'health', true, 'RULES'],
      ['AMAZON.COM', 'shopping', false, 'RULES'],
      ['LUMEN BOOKS', 'other', false, 'RULES'],
      ['Partner Telecom', 'utilities', true, 'RULES'],
      ['Card Fee', 'fees', false, 'RULES'],
      ['Cinema Lane', 'entertainment', false, 'RULES'],
      ['Skyline Hotel', 'travel', false, 'RULES'],
      ['Paybox Transfer', 'transfers', false, 'RULES'],
      ['UDEMY', 'education', false, 'RULES'],
      ['Transfer Dana Levi', 'transfers', false, 'RULES'],
    ]);
    expect(analysis.aggregates.transactionCount).toBe(30);
    expect(analysis.aggregates.currencyTotals).toEqual([
      { currency: 'ILS', total: 4604.65, count: 29 },
      { currency: 'EUR', total: 42.5, count: 1 },
    ]);
    expect(analysis.aggregates.monthTotals.map((row) => [row.month, row.currency, row.total])).toEqual([
      ['2025-03', 'ILS', 480],
      ['2025-12', 'ILS', 74.8],
      ['2026-01', 'ILS', 456.9],
      ['2026-02', 'ILS', 1154.5],
      ['2026-03', 'EUR', 42.5],
      ['2026-03', 'ILS', 2438.45],
    ]);
    expect(analysis.aggregates.topMerchants[0]).toMatchObject({ merchant: 'NORTHWIND INSURANCE', total: 960 });
    expect(analysis.subscriptions.map((row) => [row.merchant, row.cadence, row.monthlyCost])).toEqual([
      ['Partner Telecom', 'monthly', 302.1],
      ['NETFLIX.COM', 'monthly', 54.9],
      ['NORTHWIND INSURANCE', 'annual', 40],
      ['SPOTIFY', 'monthly', 19.9],
    ]);
    expect(analysis.anomalies.some((row) => row.kind === 'large' && row.merchant === 'Skyline Hotel' && row.amount === 640)).toBe(true);
    expect(analysis.anomalies.filter((row) => row.kind === 'duplicate').map((row) => row.merchant)).toEqual(['GETT', 'GETT']);
    expect(analysis.anomalies.some((row) => row.kind === 'foreign_currency' && row.currency === 'EUR')).toBe(true);
    expect(analysis.anomalies.some((row) => row.kind === 'fee' && row.merchant === 'Card Fee')).toBe(true);
    expect(analysis.payload.merchants).toContain('Transfer [REDACTED_NAME]');
    expect(analysis.payload.merchants.join('\n')).not.toContain('Dana Levi');

    for (const transaction of analysis.transactions) {
      const schemaTx = toSchemaTransaction(transaction);
      expect(schemaTx).not.toHaveProperty('installments');
      expect(schemaTx).not.toHaveProperty('inferenceSource');
      expect(validate(schemaTx), JSON.stringify(validate.errors)).toBe(true);
      if (transaction.amount < 0) {
        expect(schemaTx.amount).toBeLessThan(0);
      }
    }
    expect(analysis.transactions.some((transaction) => transaction.amount < 0)).toBe(true);
  });
});
