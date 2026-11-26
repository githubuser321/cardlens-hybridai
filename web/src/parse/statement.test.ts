import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import transactionSchema from '../../../shared/schema/transaction.schema.json';
import type { PdfTextItem } from '../pdf/text-items-to-lines';
import { parsedToSchemaTransaction } from './schema-transaction';
import {
  parseStatementItems,
  parseStatementLines,
  type ParsedTransaction,
} from './statement';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(transactionSchema);

function only(line: string): ParsedTransaction {
  const rows = parseStatementLines([line]);
  expect(rows, line).toHaveLength(1);
  const row = rows[0];
  if (!row) {
    throw new Error(`missing row for ${line}`);
  }
  return row;
}

describe('parseStatementLines', () => {
  it('reads Hebrew and English charges as positive amounts', () => {
    expect(only('01/03/26 שופרסל 245.90')).toMatchObject({
      date: '2026-03-01',
      merchant: 'שופרסל',
      amount: 245.9,
      currency: 'ILS',
      installments: null,
    });
    expect(only('02/03/26 SHELL 80.00')).toMatchObject({
      date: '2026-03-02',
      merchant: 'SHELL',
      amount: 80,
      currency: 'ILS',
    });
  });

  it('treats dates as day/month/year', () => {
    expect(only('13/02/26 STORE 10.00').date).toBe('2026-02-13');
    expect(only('15/03/2026 STORE 10.00').date).toBe('2026-03-15');
    expect(only('09.03.26 STORE 10.00').date).toBe('2026-03-09');
    expect(only('29/02/24 STORE 10.00').date).toBe('2024-02-29');
    expect(parseStatementLines(['02/13/26 STORE 10.00'])).toEqual([]);
    expect(parseStatementLines(['32/01/26 STORE 10.00'])).toEqual([]);
    expect(parseStatementLines(['29/02/26 STORE 10.00'])).toEqual([]);
  });

  it('parses shekels, foreign currency, thousands separators, and a billing amount', () => {
    expect(only('03/03/26 סונול ₪320')).toMatchObject({ amount: 320, currency: 'ILS', merchant: 'סונול' });
    expect(only('11/03/26 שופרסל ש״ח 20.00')).toMatchObject({ amount: 20, currency: 'ILS' });
    expect(only('10/03/26 וולט NIS 63.50')).toMatchObject({ amount: 63.5, currency: 'ILS', merchant: 'וולט' });
    expect(only('06/03/26 AMAZON.COM USD 29.99')).toMatchObject({
      amount: 29.99,
      currency: 'USD',
      merchant: 'AMAZON.COM',
    });
    expect(only('07/03/26 BOOK STORE €15.00')).toMatchObject({ amount: 15, currency: 'EUR', merchant: 'BOOK STORE' });
    expect(only('08/03/26 רמי לוי 1,234.56')).toMatchObject({ amount: 1234.56, currency: 'ILS' });
    expect(only('08/03/26 רמי לוי 245,90')).toMatchObject({ amount: 245.9, currency: 'ILS' });
    expect(only('06/03/26 AMAZON.COM USD 29.99 112.40')).toMatchObject({
      amount: 112.4,
      currency: 'ILS',
      merchant: 'AMAZON.COM',
    });
  });

  it('keeps refunds and credits negative, including a positive amount labeled as a refund', () => {
    expect(only('20/02/26 זיכוי אמזון -89.00')).toMatchObject({ merchant: 'זיכוי אמזון', amount: -89 });
    expect(only('13/03/26 REFUND NETFLIX 15.00')).toMatchObject({ merchant: 'REFUND NETFLIX', amount: -15 });
    expect(only('07/03/26 פז יילו (75.50)')).toMatchObject({ amount: -75.5, merchant: 'פז יילו' });
    expect(only('07/03/26 פז יילו 75.50-')).toMatchObject({ amount: -75.5 });
    expect(only('21/03/26 החזר מונית −45.20').amount).toBe(-45.2);
  });

  it('captures installment plans without putting them in the shared schema object', () => {
    expect(only('04/03/26 IKEA 400.00 3/12')).toMatchObject({
      merchant: 'IKEA',
      amount: 400,
      installments: { current: 3, total: 12 },
    });
    expect(only('10/02/26 סופר-פארם 89.90 תשלום 2 מתוך 6').installments).toEqual({ current: 2, total: 6 });
    expect(only('10/02/26 IKEA 40.00 installment 3 of 12').installments).toEqual({ current: 3, total: 12 });
    const schemaTx = parsedToSchemaTransaction(only('04/03/26 IKEA 400.00 3/12'));
    expect(schemaTx).not.toHaveProperty('installments');
    expect(schemaTx.isRecurring).toBe(true);
    expect(validate(schemaTx), JSON.stringify(validate.errors)).toBe(true);
  });

  it('skips totals, headers, and invalid rows, and keeps a merchant that merely contains the word total', () => {
    expect(parseStatementLines([
      'סה"כ לחיוב 9,999.99',
      'סה״כ עסקאות 17',
      'TOTAL 9999.99',
      'סך הכל 100.00',
      '31/03/26 סה"כ לחיוב 9,999.99',
      '31/03/26 יתרה קודמת 120.00',
      'תאריך בית עסק סכום',
      'כרטיס: 4111-1111-1111-1111',
    ])).toEqual([]);
    expect(only('01/03/26 TOTAL WINE 42.00').merchant).toBe('TOTAL WINE');
  });

  it('recovers RTL lines whether the whole string or the token order was reversed', () => {
    expect(only('09.542 לסרפוש 62/30/10')).toMatchObject({
      date: '2026-03-01',
      merchant: 'שופרסל',
      amount: 245.9,
      currency: 'ILS',
    });
    expect(only('245.90 שופרסל 01/03/26').merchant).toBe('שופרסל');
    expect(only('189.40 שיווק לוי רמי 02/03/26')).toMatchObject({
      date: '2026-03-02',
      merchant: 'רמי לוי שיווק',
      amount: 189.4,
    });
    expect(only('21/3 00.004 AEKI 62/30/40')).toMatchObject({
      date: '2026-03-04',
      merchant: 'IKEA',
      amount: 400,
      installments: { current: 3, total: 12 },
    });
  });

  it('parses pdf.js items that were concatenated without spaces', () => {
    const items: PdfTextItem[] = [
      { str: '01/03/26', transform: [1, 0, 0, 1, 40, 700] },
      { str: 'שופרסל', transform: [1, 0, 0, 1, 120, 700] },
      { str: '245.90', transform: [1, 0, 0, 1, 200, 700], hasEOL: true },
      { str: '02/03/26 NETFLIX.COM 54.90', transform: [1, 0, 0, 1, 40, 680], hasEOL: true },
    ];
    expect(parseStatementItems(items)).toEqual([
      {
        date: '2026-03-01',
        merchant: 'שופרסל',
        amount: 245.9,
        currency: 'ILS',
        installments: null,
      },
      {
        date: '2026-03-02',
        merchant: 'NETFLIX.COM',
        amount: 54.9,
        currency: 'ILS',
        installments: null,
      },
    ]);
  });

  it('emits schema-valid transactions for a glued Hebrew row', () => {
    const schemaTx = parsedToSchemaTransaction(only('01/03/26שופרסל245.90'));
    expect(schemaTx.amount).toBeGreaterThan(0);
    expect(validate(schemaTx), JSON.stringify(validate.errors)).toBe(true);
  });
});
