import { isCategory } from '../analyze/categories';
import type { SchemaTransaction } from '../parse/schema-transaction';

/** Runtime check for the six shared-schema fields. Does not accept extra properties. */
export function isValidSchemaTransaction(value: SchemaTransaction): boolean {
  const keys = Object.keys(value);
  if (keys.length !== 6) {
    return false;
  }
  return isIsoDate(value.date)
    && value.merchant.trim().length > 0
    && typeof value.amount === 'number'
    && Number.isFinite(value.amount)
    && /^[A-Z]{3}$/.test(value.currency)
    && isCategory(value.category)
    && typeof value.isRecurring === 'boolean';
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
