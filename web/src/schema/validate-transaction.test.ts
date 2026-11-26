import { describe, expect, it } from 'vitest';
import { isValidSchemaTransaction } from './validate-transaction';

const valid = {
  date: '2026-03-01',
  merchant: 'Greenleaf Market',
  amount: 86.4,
  currency: 'ILS',
  category: 'groceries',
  isRecurring: false,
};

describe('isValidSchemaTransaction', () => {
  it('accepts a shared-schema transaction and rejects bad fields', () => {
    expect(isValidSchemaTransaction(valid)).toBe(true);
    expect(isValidSchemaTransaction({ ...valid, amount: -42.5, category: 'shopping' })).toBe(true);
    expect(isValidSchemaTransaction({ ...valid, category: 'food' })).toBe(false);
    expect(isValidSchemaTransaction({ ...valid, currency: 'ils' })).toBe(false);
    expect(isValidSchemaTransaction({ ...valid, date: '2026-02-31' })).toBe(false);
    expect(isValidSchemaTransaction({ ...valid, merchant: ' ' })).toBe(false);
    expect(isValidSchemaTransaction({ ...valid, isRecurring: true })).toBe(true);
  });
});
