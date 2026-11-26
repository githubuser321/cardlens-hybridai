import { looksLikeFee } from '../analyze/rules';
import { normalizeForMatch } from '../text/normalize';
import { daysBetween, median } from './numbers';

export type AnomalyKind = 'large' | 'duplicate' | 'new_merchant' | 'foreign_currency' | 'fee';

export interface AnomalyInput {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
}

export interface Anomaly {
  kind: AnomalyKind;
  index: number;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  reason: string;
}

const DUPLICATE_WINDOW_DAYS = 3;
const MERCHANT_LARGE_RATIO = 2.5;
const CATEGORY_LARGE_RATIO = 3;
const MERCHANT_LARGE_GAP = 40;
const CATEGORY_LARGE_GAP = 80;

/**
 * Deterministic checks against the statement itself:
 * large charges versus merchant or category history, near-duplicate charges,
 * merchants that first appear in the latest month, foreign currency, and fees.
 */
export function detectAnomalies(transactions: readonly AnomalyInput[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const dominant = dominantCurrency(transactions);
  const latestMonth = latestMonthOf(transactions);
  const spansMonths = new Set(transactions.map((transaction) => transaction.date.slice(0, 7))).size > 1;
  const firstMonth = earliestMonthByMerchant(transactions);

  transactions.forEach((transaction, index) => {
    const large = largeChargeReason(transactions, index);
    if (large) {
      anomalies.push(make(transaction, index, 'large', large));
    }
    const duplicate = duplicateReason(transactions, index);
    if (duplicate) {
      anomalies.push(make(transaction, index, 'duplicate', duplicate));
    }
    if (spansMonths && latestMonth && firstMonth.get(normalizeForMatch(transaction.merchant)) === latestMonth) {
      anomalies.push(make(
        transaction,
        index,
        'new_merchant',
        'First time this merchant appears, in the latest month of this statement.',
      ));
    }
    if (dominant && transaction.currency !== dominant) {
      anomalies.push(make(
        transaction,
        index,
        'foreign_currency',
        `Charged in ${transaction.currency}. Most charges on this statement are ${dominant}.`,
      ));
    }
    if (transaction.category === 'fees' || looksLikeFee(transaction.merchant)) {
      anomalies.push(make(transaction, index, 'fee', 'Card fee, interest, or other fee charge.'));
    }
  });

  return anomalies;
}

export function countAnomalies(anomalies: readonly Anomaly[]): {
  large: number;
  duplicate: number;
  newMerchant: number;
  foreignCurrency: number;
  fee: number;
} {
  const counts = { large: 0, duplicate: 0, newMerchant: 0, foreignCurrency: 0, fee: 0 };
  for (const anomaly of anomalies) {
    switch (anomaly.kind) {
      case 'large':
        counts.large += 1;
        break;
      case 'duplicate':
        counts.duplicate += 1;
        break;
      case 'new_merchant':
        counts.newMerchant += 1;
        break;
      case 'foreign_currency':
        counts.foreignCurrency += 1;
        break;
      case 'fee':
        counts.fee += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}

function make(transaction: AnomalyInput, index: number, kind: AnomalyKind, reason: string): Anomaly {
  return {
    kind,
    index,
    merchant: transaction.merchant,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.date,
    reason,
  };
}

function largeChargeReason(transactions: readonly AnomalyInput[], index: number): string | null {
  const current = transactions[index];
  if (!current || !(current.amount > 0)) {
    return null;
  }
  const merchantHistory = transactions.filter((transaction, other) => other !== index
    && transaction.amount > 0
    && transaction.currency === current.currency
    && normalizeForMatch(transaction.merchant) === normalizeForMatch(current.merchant));
  if (merchantHistory.length >= 2) {
    const middle = median(merchantHistory.map((transaction) => transaction.amount));
    if (current.amount >= middle * MERCHANT_LARGE_RATIO && current.amount - middle >= MERCHANT_LARGE_GAP) {
      return `Charge is unusually large next to the usual ${formatAmount(middle, current.currency)} at this merchant.`;
    }
    return null;
  }
  const categoryHistory = transactions.filter((transaction, other) => other !== index
    && transaction.amount > 0
    && transaction.currency === current.currency
    && transaction.category === current.category);
  if (categoryHistory.length < 3) {
    return null;
  }
  const middle = median(categoryHistory.map((transaction) => transaction.amount));
  if (current.amount >= middle * CATEGORY_LARGE_RATIO && current.amount - middle >= CATEGORY_LARGE_GAP) {
    return `Charge is unusually large next to other ${current.category} charges (usual ${formatAmount(middle, current.currency)}).`;
  }
  return null;
}

function duplicateReason(transactions: readonly AnomalyInput[], index: number): string | null {
  const current = transactions[index];
  if (!current || !(current.amount > 0)) {
    return null;
  }
  const cents = Math.round(current.amount * 100);
  let nearest: { date: string; days: number } | null = null;
  transactions.forEach((transaction, other) => {
    if (other === index || !(transaction.amount > 0)) {
      return;
    }
    if (transaction.currency !== current.currency || Math.round(transaction.amount * 100) !== cents) {
      return;
    }
    if (normalizeForMatch(transaction.merchant) !== normalizeForMatch(current.merchant)) {
      return;
    }
    const days = Math.abs(daysBetween(transaction.date, current.date));
    if (!Number.isFinite(days) || days > DUPLICATE_WINDOW_DAYS) {
      return;
    }
    if (!nearest || days < nearest.days) {
      nearest = { date: transaction.date, days };
    }
  });
  if (!nearest) {
    return null;
  }
  const match: { date: string; days: number } = nearest;
  const dayLabel = match.days === 1 ? '1 day' : `${match.days} days`;
  return `Same merchant and amount as the charge on ${match.date} (${dayLabel} apart).`;
}

function dominantCurrency(transactions: readonly AnomalyInput[]): string | null {
  const counts = new Map<string, { count: number; cents: number }>();
  for (const transaction of transactions) {
    const bucket = counts.get(transaction.currency) ?? { count: 0, cents: 0 };
    bucket.count += 1;
    bucket.cents += Math.abs(Math.round(transaction.amount * 100));
    counts.set(transaction.currency, bucket);
  }
  const ranked = [...counts.entries()].sort((left, right) => {
    return right[1].count - left[1].count
      || right[1].cents - left[1].cents
      || left[0].localeCompare(right[0]);
  });
  return ranked[0]?.[0] ?? null;
}

function latestMonthOf(transactions: readonly AnomalyInput[]): string | null {
  let latest = '';
  for (const transaction of transactions) {
    const month = transaction.date.slice(0, 7);
    if (month > latest) {
      latest = month;
    }
  }
  return latest || null;
}

function earliestMonthByMerchant(transactions: readonly AnomalyInput[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const transaction of transactions) {
    const key = normalizeForMatch(transaction.merchant);
    const month = transaction.date.slice(0, 7);
    const current = first.get(key);
    if (!current || month < current) {
      first.set(key, month);
    }
  }
  return first;
}

function formatAmount(amount: number, currency: string): string {
  return `${(Math.round(amount * 100) / 100).toFixed(2)} ${currency}`;
}
