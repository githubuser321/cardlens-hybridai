import type { Aggregates } from '../analyze/aggregates';
import { formatCategory, formatMoney, formatMonth, headlineTotals } from '../ui/format';
import { countAnomalies, type Anomaly } from './anomalies';
import { monthlyCostByCurrency, type Subscription } from './subscriptions';

export function localInsights(input: {
  aggregates: Aggregates;
  subscriptions: readonly Subscription[];
  anomalies: readonly Anomaly[];
}): { summary: string; insights: string[] } {
  const { aggregates, subscriptions, anomalies } = input;
  if (aggregates.transactionCount === 0) {
    return {
      summary: 'No transactions to summarize.',
      insights: ['Load a statement to see spending insights.'],
    };
  }

  const months = new Set(aggregates.monthTotals.map((row) => row.month));
  const summary = `${aggregates.transactionCount} transactions across ${months.size} month${months.size === 1 ? '' : 's'}. ${headlineTotals(aggregates)}.`;
  const insights: string[] = [];

  if (subscriptions.length === 0) {
    insights.push('No monthly or annual subscriptions were detected.');
  } else {
    const costText = monthlyCostByCurrency(subscriptions)
      .map((row) => formatMoney(row.total, row.currency))
      .join(', ');
    const names = subscriptions.map((subscription) => subscription.merchant).join(', ');
    const label = subscriptions.length === 1 ? 'recurring charge' : 'recurring charges';
    insights.push(`${subscriptions.length} ${label} (${names}), about ${costText} per month.`);
  }

  const counts = countAnomalies(anomalies);
  const parts = [
    counts.large ? `${counts.large} unusually large` : '',
    counts.duplicate ? `${counts.duplicate} duplicate` : '',
    counts.newMerchant ? `${counts.newMerchant} new-merchant` : '',
    counts.foreignCurrency ? `${counts.foreignCurrency} foreign-currency` : '',
    counts.fee ? `${counts.fee} fee` : '',
  ].filter(Boolean);
  insights.push(parts.length === 0
    ? 'No unusual charges, duplicates, new merchants, foreign-currency charges, or fees were flagged.'
    : `Flagged charges: ${parts.join(', ')}.`);

  const largest = [...aggregates.categoryTotals].sort((left, right) => Math.abs(right.total) - Math.abs(left.total))[0];
  if (largest) {
    insights.push(`Largest category is ${formatCategory(largest.category)} at ${formatMoney(largest.total, largest.currency)}.`);
  }

  const primary = aggregates.currencyTotals[0]?.currency;
  const primaryMonths = aggregates.monthTotals.filter((row) => row.currency === primary);
  const previous = primaryMonths[primaryMonths.length - 2];
  const current = primaryMonths[primaryMonths.length - 1];
  if (primary && previous && current) {
    const direction = current.total > previous.total ? 'up' : current.total < previous.total ? 'down' : 'unchanged';
    insights.push(`Spending in ${current.currency} was ${direction} from ${formatMonth(previous.month)} to ${formatMonth(current.month)}.`);
  }

  return { summary, insights: insights.slice(0, 4) };
}
