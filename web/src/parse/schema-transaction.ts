import type { ParsedTransaction } from './statement';

/**
 * The six fields in shared/schema/transaction.schema.json.
 * Installment plans stay off this object: the schema sets additionalProperties to false
 * and Android reads the same contract. A charge is positive; a credit or refund is negative.
 */
export interface SchemaTransaction {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  isRecurring: boolean;
}

export function toSchemaTransaction(input: {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  isRecurring: boolean;
}): SchemaTransaction {
  return {
    date: input.date,
    merchant: input.merchant,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    isRecurring: input.isRecurring,
  };
}

/** Parser output plus a placeholder category, before keyword or model categorization. */
export function parsedToSchemaTransaction(
  parsed: ParsedTransaction,
  category = 'other',
): SchemaTransaction {
  return toSchemaTransaction({
    date: parsed.date,
    merchant: parsed.merchant,
    amount: parsed.amount,
    currency: parsed.currency,
    category,
    isRecurring: parsed.installments !== null,
  });
}
