import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import categories from '../../../shared/schema/categories.json';
import transactionSchema from '../../../shared/schema/transaction.schema.json';
import {
  buildCategorizationResponseSchema,
  categoriesMatchSchema,
  transactionResponseJsonSchema,
} from './shared-schema';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(transactionSchema);

const sample = {
  date: '2026-01-15',
  merchant: 'WHOLE FOODS MARKET',
  amount: 42.18,
  currency: 'USD',
  category: 'groceries',
  isRecurring: false,
};

describe('transaction schema', () => {
  it('matches categories.json and stays compact', () => {
    expect(categoriesMatchSchema()).toBe(true);
    expect(transactionSchema.properties.category.enum).toEqual([...categories]);
    expect(transactionSchema.additionalProperties).toBe(false);
    expect(transactionSchema.required).toEqual([
      'date',
      'merchant',
      'amount',
      'currency',
      'category',
      'isRecurring',
    ]);
    const forDevice = transactionResponseJsonSchema();
    expect(forDevice).not.toHaveProperty('$schema');
    expect(forDevice).not.toHaveProperty('examples');
    expect(JSON.stringify(forDevice).length).toBeLessThan(1200);
    expect(transactionSchema.properties.amount.description).toBe(
      'Positive number = charge. Negative number = credit or refund.',
    );
  });

  it('validates every fictional example, including a refund and a recurring charge', () => {
    const examples = transactionSchema.examples;
    expect(examples.length).toBeGreaterThanOrEqual(2);
    expect(examples.length).toBeLessThanOrEqual(3);
    for (const example of examples) {
      expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
      expect(Object.keys(example).sort()).toEqual([
        'amount',
        'category',
        'currency',
        'date',
        'isRecurring',
        'merchant',
      ]);
    }
    expect(examples.some((example) => example.amount > 0)).toBe(true);
    expect(examples.some((example) => example.amount < 0)).toBe(true);
    expect(examples.some((example) => example.isRecurring)).toBe(true);
    expect(examples.some((example) => example.isRecurring === false)).toBe(true);
  });

  it('accepts a sample transaction', () => {
    expect(validate(sample)).toBe(true);
  });

  it('rejects extra properties, bad categories, and non-ISO fields', () => {
    expect(validate({ ...sample, note: 'secret' })).toBe(false);
    expect(validate({ ...sample, category: 'food' })).toBe(false);
    expect(validate({ ...sample, currency: 'usd' })).toBe(false);
    expect(validate({ ...sample, date: '01/15/2026' })).toBe(false);
    expect(validate({ ...sample, date: '2026-13-01' })).toBe(false);
    expect(validate({ ...sample, amount: '42.18' })).toBe(false);
    expect(validate({ ...sample, isRecurring: 'false' })).toBe(false);
    expect(
      validate({
        date: sample.date,
        amount: sample.amount,
        currency: sample.currency,
        category: sample.category,
        isRecurring: sample.isRecurring,
      }),
    ).toBe(false);
  });
});

describe('categorization response schema', () => {
  it('derives the category enum from the shared schema', () => {
    const responseSchema = buildCategorizationResponseSchema();
    const serialized = JSON.stringify(responseSchema);
    expect(serialized).not.toContain('$schema');
    expect(serialized).not.toContain('description');
    expect(serialized.length).toBeLessThan(1500);
    expect(responseSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['categorizations'],
    });

    const properties = responseSchema.properties as {
      categorizations: { items: { properties: { category: { enum: string[] } } } };
    };
    expect(properties.categorizations.items.properties.category.enum).toEqual([...categories]);

    const forDevice = transactionResponseJsonSchema();
    expect(forDevice).not.toHaveProperty('$schema');
    expect(forDevice.required).toEqual(transactionSchema.required);
  });
});
