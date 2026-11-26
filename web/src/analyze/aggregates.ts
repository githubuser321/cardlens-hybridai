export interface MoneyTotal {
  total: number;
  count: number;
}

export interface CategoryTotal extends MoneyTotal {
  category: string;
  currency: string;
}

export interface MonthTotal extends MoneyTotal {
  /** YYYY-MM */
  month: string;
  currency: string;
}

export interface MerchantTotal extends MoneyTotal {
  merchant: string;
  currency: string;
}

export interface CurrencyTotal extends MoneyTotal {
  currency: string;
}

export interface Aggregates {
  categoryTotals: CategoryTotal[];
  monthTotals: MonthTotal[];
  topMerchants: MerchantTotal[];
  currencyTotals: CurrencyTotal[];
  transactionCount: number;
}

export interface AggregateInput {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
}

/** Sum charges and refunds in cents so mixed currencies are never added together. */
export function aggregateTransactions(
  transactions: readonly AggregateInput[],
  topMerchants = 5,
): Aggregates {
  const categories = new Map<string, { cents: number; count: number; category: string; currency: string }>();
  const months = new Map<string, { cents: number; count: number; month: string; currency: string }>();
  const merchants = new Map<string, { cents: number; count: number; merchant: string; currency: string }>();
  const currencies = new Map<string, { cents: number; count: number }>();

  for (const transaction of transactions) {
    const cents = Math.round(transaction.amount * 100);
    add(currencies, transaction.currency, cents, { cents: 0, count: 0 });
    const categoryKey = `${transaction.category}\0${transaction.currency}`;
    add(categories, categoryKey, cents, {
      cents: 0,
      count: 0,
      category: transaction.category,
      currency: transaction.currency,
    });
    const month = transaction.date.slice(0, 7);
    const monthKey = `${month}\0${transaction.currency}`;
    add(months, monthKey, cents, { cents: 0, count: 0, month, currency: transaction.currency });
    const merchantKey = `${transaction.merchant}\0${transaction.currency}`;
    add(merchants, merchantKey, cents, {
      cents: 0,
      count: 0,
      merchant: transaction.merchant,
      currency: transaction.currency,
    });
  }

  return {
    categoryTotals: [...categories.values()]
      .map(toTotal)
      .sort(byTotalThen((row) => `${row.category}${row.currency}`)),
    monthTotals: [...months.values()]
      .map(toMonth)
      .sort((left, right) => left.month.localeCompare(right.month) || left.currency.localeCompare(right.currency)),
    topMerchants: [...merchants.values()]
      .map(toMerchant)
      .sort(byTotalThen((row) => row.merchant))
      .slice(0, topMerchants),
    currencyTotals: [...currencies.entries()]
      .map(([currency, bucket]) => ({
        currency,
        total: bucket.cents / 100,
        count: bucket.count,
      }))
      .sort((left, right) => right.total - left.total || left.currency.localeCompare(right.currency)),
    transactionCount: transactions.length,
  };
}

function add<T extends { cents: number; count: number }>(
  map: Map<string, T>,
  key: string,
  cents: number,
  initial: T,
): void {
  const bucket = map.get(key) ?? initial;
  bucket.cents += cents;
  bucket.count += 1;
  map.set(key, bucket);
}

function toTotal(bucket: { cents: number; count: number; category: string; currency: string }): CategoryTotal {
  return {
    category: bucket.category,
    currency: bucket.currency,
    total: bucket.cents / 100,
    count: bucket.count,
  };
}

function toMonth(bucket: { cents: number; count: number; month: string; currency: string }): MonthTotal {
  return {
    month: bucket.month,
    currency: bucket.currency,
    total: bucket.cents / 100,
    count: bucket.count,
  };
}

function toMerchant(bucket: { cents: number; count: number; merchant: string; currency: string }): MerchantTotal {
  return {
    merchant: bucket.merchant,
    currency: bucket.currency,
    total: bucket.cents / 100,
    count: bucket.count,
  };
}

function byTotalThen<T extends { total: number }>(label: (row: T) => string): (left: T, right: T) => number {
  return (left, right) => right.total - left.total || label(left).localeCompare(label(right));
}
