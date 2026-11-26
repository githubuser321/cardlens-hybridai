import type { Subscription } from '../insights/subscriptions';

export interface ComparedTransaction {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
}

export interface CategoryDelta {
  category: string;
  currency: string;
  previousAmount: number;
  currentAmount: number;
  deltaAmount: number;
  /** Null when the previous month total is zero. */
  deltaPercent: number | null;
  notable: boolean;
}

export interface SubscriptionChange {
  merchant: string;
  currency: string;
  cadence: Subscription['cadence'];
  monthlyCost: number;
  change: 'new' | 'stopped';
}

export interface MonthComparison {
  previousMonth: string;
  currentMonth: string;
  categoryDeltas: CategoryDelta[];
  subscriptionChanges: SubscriptionChange[];
}

const MONTH = /^(\d{4})-(\d{2})$/;

/**
 * Compare the two latest months in the statement.
 * Totals are net of charges and credits, per category and currency.
 * A subscription is new or stopped when its charges fall in only one of those months.
 */
export function compareMonths(
  transactions: readonly ComparedTransaction[],
  subscriptions: readonly Subscription[],
  notableDeltaPercent = 25,
): MonthComparison | null {
  const months = new Set<string>();
  for (const transaction of transactions) {
    const month = monthOf(transaction.date);
    if (month) {
      months.add(month);
    }
  }
  const ordered = [...months].sort((left, right) => left.localeCompare(right));
  const currentMonth = ordered[ordered.length - 1];
  const previousMonth = ordered[ordered.length - 2];
  if (!currentMonth || !previousMonth) {
    return null;
  }

  const threshold = Number.isFinite(notableDeltaPercent) ? notableDeltaPercent : 25;
  const buckets = new Map<string, { category: string; currency: string; previous: number; current: number }>();
  for (const transaction of transactions) {
    const month = monthOf(transaction.date);
    if (month !== previousMonth && month !== currentMonth) {
      continue;
    }
    const key = `${transaction.category}\0${transaction.currency}`;
    const bucket = buckets.get(key) ?? {
      category: transaction.category,
      currency: transaction.currency,
      previous: 0,
      current: 0,
    };
    const cents = Math.round(transaction.amount * 100);
    if (month === previousMonth) {
      bucket.previous += cents;
    } else {
      bucket.current += cents;
    }
    buckets.set(key, bucket);
  }

  const categoryDeltas = [...buckets.values()]
    .filter((bucket) => bucket.previous !== 0 || bucket.current !== 0)
    .map((bucket): CategoryDelta => {
      const deltaCents = bucket.current - bucket.previous;
      const deltaPercent = deltaPercentFromCents(bucket.previous, bucket.current);
      return {
        category: bucket.category,
        currency: bucket.currency,
        previousAmount: bucket.previous / 100,
        currentAmount: bucket.current / 100,
        deltaAmount: deltaCents / 100,
        deltaPercent,
        notable: isNotable(deltaPercent, deltaCents, threshold),
      };
    })
    .sort((left, right) => Math.abs(right.deltaAmount) - Math.abs(left.deltaAmount)
      || left.category.localeCompare(right.category)
      || left.currency.localeCompare(right.currency));

  const subscriptionChanges: SubscriptionChange[] = [];
  for (const subscription of subscriptions) {
    const inPrevious = activeInMonth(subscription, transactions, previousMonth);
    const inCurrent = activeInMonth(subscription, transactions, currentMonth);
    if (inCurrent === inPrevious) {
      continue;
    }
    subscriptionChanges.push({
      merchant: subscription.merchant,
      currency: subscription.currency,
      cadence: subscription.cadence,
      monthlyCost: subscription.monthlyCost,
      change: inCurrent ? 'new' : 'stopped',
    });
  }
  subscriptionChanges.sort((left, right) => left.change.localeCompare(right.change)
    || left.merchant.localeCompare(right.merchant)
    || left.currency.localeCompare(right.currency));

  return { previousMonth, currentMonth, categoryDeltas, subscriptionChanges };
}

export function deltaPercentFromCents(previousCents: number, currentCents: number): number | null {
  if (previousCents === 0) {
    return null;
  }
  return Math.round(((currentCents - previousCents) / Math.abs(previousCents)) * 1000) / 10;
}

export function formatDeltaPercent(percent: number | null, deltaAmount: number): string {
  if (percent === null) {
    return deltaAmount === 0 ? '0%' : 'New';
  }
  const text = Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
  return percent > 0 ? `+${text}%` : `${text}%`;
}

function isNotable(percent: number | null, deltaCents: number, threshold: number): boolean {
  if (deltaCents === 0) {
    return false;
  }
  if (percent === null) {
    return true;
  }
  return Math.abs(percent) >= threshold;
}

function activeInMonth(
  subscription: Subscription,
  transactions: readonly ComparedTransaction[],
  month: string,
): boolean {
  return subscription.transactionIndexes.some((index) => monthOf(transactions[index]?.date ?? '') === month);
}

function monthOf(date: string): string | null {
  const month = date.slice(0, 7);
  return MONTH.test(month) ? month : null;
}
