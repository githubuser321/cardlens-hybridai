import type { Aggregates } from '../analyze/aggregates';

export function formatCategory(category: string): string {
  if (!category) {
    return category;
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const sign = amount < 0 ? '-' : '';
    return `${sign}${Math.abs(amount).toFixed(2)} ${currency}`;
  }
}

/** Short calendar date that stays on one line in a card or table. */
export function formatStatementDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) {
    return value;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** A saved consent time, without the raw ISO string. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match?.[1] || !match[2]) {
    return month;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatInstallment(current: number, total: number): string {
  return `Installment ${current}/${total}`;
}

export function formatCadence(cadence: string): string {
  if (cadence === 'monthly') {
    return 'Monthly';
  }
  if (cadence === 'annual') {
    return 'Annual';
  }
  return cadence;
}

export function formatAnomalyKind(kind: string): string {
  switch (kind) {
    case 'large':
      return 'Large charge';
    case 'duplicate':
      return 'Duplicate';
    case 'new_merchant':
      return 'New merchant';
    case 'foreign_currency':
      return 'Foreign currency';
    case 'fee':
      return 'Fee';
    default:
      return kind;
  }
}

/** Bar widths from 0 to 100, based on the largest absolute total. */
export function barWidths(totals: readonly number[]): number[] {
  const max = totals.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
  if (max === 0) {
    return totals.map(() => 0);
  }
  return totals.map((value) => Math.round((Math.abs(value) / max) * 1000) / 10);
}

export function headlineTotals(aggregates: Aggregates): string {
  if (aggregates.currencyTotals.length === 0) {
    return formatMoney(0, 'ILS');
  }
  return aggregates.currencyTotals
    .map((entry) => formatMoney(entry.total, entry.currency))
    .join(' · ');
}

export function filterTransactions<T extends { category: string }>(
  transactions: readonly T[],
  category: string,
): T[] {
  if (category === 'all') {
    return [...transactions];
  }
  return transactions.filter((transaction) => transaction.category === category);
}
