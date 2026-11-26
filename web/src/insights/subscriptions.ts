import { normalizeForMatch } from '../text/normalize';
import { daysBetween, median, roundMoney } from './numbers';

export type Cadence = 'monthly' | 'annual';

export interface SubscriptionInput {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
}

export interface Subscription {
  merchant: string;
  normalizedMerchant: string;
  cadence: Cadence;
  currency: string;
  occurrenceCount: number;
  /** Typical charge converted to a per-month estimate. */
  monthlyCost: number;
  transactionIndexes: number[];
}

const MONTHLY_MIN_DAYS = 25;
const MONTHLY_MAX_DAYS = 35;
const ANNUAL_MIN_DAYS = 350;
const ANNUAL_MAX_DAYS = 380;
const AMOUNT_RATIO = 0.15;

/**
 * Same normalized merchant, same currency, positive charges at a monthly or annual gap,
 * with amounts within 15% of the median (or 1.00 in absolute terms).
 * Monthly needs three charges. Annual needs two.
 */
export function detectSubscriptions(transactions: readonly SubscriptionInput[]): Subscription[] {
  const groups = new Map<string, { index: number; transaction: SubscriptionInput }[]>();
  transactions.forEach((transaction, index) => {
    if (!(transaction.amount > 0) || !transaction.merchant.trim()) {
      return;
    }
    const normalized = normalizeForMatch(transaction.merchant);
    if (!normalized) {
      return;
    }
    const key = `${normalized}\0${transaction.currency}`;
    const bucket = groups.get(key) ?? [];
    bucket.push({ index, transaction });
    groups.set(key, bucket);
  });

  const found: Subscription[] = [];
  for (const [key, rows] of groups) {
    const normalizedMerchant = key.split('\0')[0] ?? '';
    const ordered = [...rows].sort((left, right) => left.transaction.date.localeCompare(right.transaction.date) || left.index - right.index);
    const cadence = cadenceOf(ordered.map((row) => row.transaction.date));
    if (!cadence) {
      continue;
    }
    const amounts = ordered.map((row) => row.transaction.amount);
    if (!amountsSimilar(amounts)) {
      continue;
    }
    const typical = median(amounts);
    const currency = ordered[0]?.transaction.currency ?? '';
    found.push({
      merchant: displayMerchant(ordered.map((row) => row.transaction.merchant)),
      normalizedMerchant,
      cadence,
      currency,
      occurrenceCount: ordered.length,
      monthlyCost: roundMoney(cadence === 'annual' ? typical / 12 : typical),
      transactionIndexes: ordered.map((row) => row.index),
    });
  }

  return found.sort((left, right) => right.monthlyCost - left.monthlyCost
    || left.merchant.localeCompare(right.merchant)
    || left.currency.localeCompare(right.currency));
}

export interface DisplaySubscriptionSource {
  merchant: string;
  amount: number;
  currency: string;
  category?: string;
  isRecurring?: boolean;
}

/**
 * The list the summary, Subscriptions tab, and Insights share.
 * Recurrence detection wins when it found a cadence. A one-month statement
 * has no cadence, so subscription-category and recurring charges are used.
 */
export function subscriptionsForDisplay(
  detected: readonly Subscription[],
  transactions: readonly DisplaySubscriptionSource[],
): Subscription[] {
  if (detected.length > 0) {
    return [...detected];
  }
  const grouped = new Map<string, Subscription>();
  transactions.forEach((transaction, index) => {
    if (transaction.amount <= 0) {
      return;
    }
    if (transaction.category !== 'subscriptions' && !transaction.isRecurring) {
      return;
    }
    const key = transaction.merchant.toLowerCase();
    const current = grouped.get(key);
    if (current) {
      current.monthlyCost = roundMoney(current.monthlyCost + transaction.amount);
      current.occurrenceCount += 1;
      current.transactionIndexes.push(index);
      return;
    }
    grouped.set(key, {
      merchant: transaction.merchant,
      normalizedMerchant: normalizeForMatch(transaction.merchant),
      cadence: 'monthly',
      currency: transaction.currency,
      occurrenceCount: 1,
      monthlyCost: roundMoney(transaction.amount),
      transactionIndexes: [index],
    });
  });
  return [...grouped.values()];
}

export function subscriptionIndexes(subscriptions: readonly Subscription[]): Set<number> {
  const indexes = new Set<number>();
  for (const subscription of subscriptions) {
    for (const index of subscription.transactionIndexes) {
      indexes.add(index);
    }
  }
  return indexes;
}

export function monthlyCostByCurrency(subscriptions: readonly Subscription[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const subscription of subscriptions) {
    const cents = Math.round(subscription.monthlyCost * 100);
    totals.set(subscription.currency, (totals.get(subscription.currency) ?? 0) + cents);
  }
  return [...totals.entries()]
    .map(([currency, cents]) => ({ currency, total: cents / 100 }))
    .sort((left, right) => right.total - left.total || left.currency.localeCompare(right.currency));
}

function cadenceOf(dates: readonly string[]): Cadence | null {
  if (dates.length < 2) {
    return null;
  }
  const gaps: number[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1];
    const current = dates[index];
    if (!previous || !current) {
      return null;
    }
    gaps.push(daysBetween(previous, current));
  }
  if (dates.length >= 3 && gaps.every((gap) => gap >= MONTHLY_MIN_DAYS && gap <= MONTHLY_MAX_DAYS)) {
    return 'monthly';
  }
  if (gaps.every((gap) => gap >= ANNUAL_MIN_DAYS && gap <= ANNUAL_MAX_DAYS)) {
    return 'annual';
  }
  return null;
}

function amountsSimilar(amounts: readonly number[]): boolean {
  const middle = Math.abs(median(amounts));
  return amounts.every((amount) => {
    const delta = Math.abs(amount - middle);
    if (delta <= 1) {
      return true;
    }
    if (middle === 0) {
      return false;
    }
    return delta / middle <= AMOUNT_RATIO;
  });
}

function displayMerchant(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return ranked[0]?.[0] ?? names[0] ?? '';
}
