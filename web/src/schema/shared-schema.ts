import categories from '../../../shared/schema/categories.json';
import transactionSchema from '../../../shared/schema/transaction.schema.json';

export { categories, transactionSchema };

/** Category list in `categories.json` matches the transaction schema enum. */
export function categoriesMatchSchema(): boolean {
  const fromSchema = transactionSchema.properties.category.enum;
  if (fromSchema.length !== categories.length) {
    return false;
  }
  return fromSchema.every((category, index) => category === categories[index]);
}

/**
 * Compact JSON schema for the hybrid categorization demo.
 * The category enum is the shared transaction schema's enum (kept in sync with categories.json).
 * Keywords are limited to type/properties/required/enum/items so the payload stays small
 * enough for the on-device response constraint.
 */
export function buildCategorizationResponseSchema(): Record<string, unknown> {
  if (!categoriesMatchSchema()) {
    throw new Error(
      'shared/schema/categories.json does not match transaction.schema.json category enum',
    );
  }

  return {
    type: 'object',
    additionalProperties: false,
    required: ['categorizations'],
    properties: {
      categorizations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['merchant', 'category'],
          properties: {
            merchant: { type: 'string' },
            category: { type: 'string', enum: [...categories] },
          },
        },
      },
    },
  };
}

/**
 * Transaction schema prepared as an on-device response schema.
 * Drops `$schema` (meta URL, not a constraint) and keeps the draft-2020 body.
 */
export function transactionResponseJsonSchema(): Record<string, unknown> {
  return {
    type: transactionSchema.type,
    additionalProperties: transactionSchema.additionalProperties,
    required: [...transactionSchema.required],
    properties: transactionSchema.properties,
  };
}
