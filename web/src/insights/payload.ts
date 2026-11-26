import type { Aggregates } from '../analyze/aggregates';
import { extractHeaderHints, redactText, type RedactionReport } from '../redact/redact';
import { countAnomalies, type Anomaly } from './anomalies';
import type { Subscription } from './subscriptions';

export interface InsightsSubscriptionSummary {
  merchant: string;
  cadence: Subscription['cadence'];
  currency: string;
  occurrences: number;
  monthlyCost: number;
}

export interface InsightsAggregate {
  transactionCount: number;
  categoryTotals: Aggregates['categoryTotals'];
  monthTotals: Aggregates['monthTotals'];
  currencyTotals: Aggregates['currencyTotals'];
  subscriptions: InsightsSubscriptionSummary[];
  anomalyCounts: ReturnType<typeof countAnomalies>;
}

/** Totals, subscription summary, and anomaly counts. No transaction lines. */
export function buildInsightsAggregate(input: {
  aggregates: Aggregates;
  subscriptions: readonly Subscription[];
  anomalies: readonly Anomaly[];
}): InsightsAggregate {
  return {
    transactionCount: input.aggregates.transactionCount,
    categoryTotals: input.aggregates.categoryTotals,
    monthTotals: input.aggregates.monthTotals,
    currencyTotals: input.aggregates.currencyTotals,
    subscriptions: input.subscriptions.map((subscription) => ({
      merchant: subscription.merchant,
      cadence: subscription.cadence,
      currency: subscription.currency,
      occurrences: subscription.occurrenceCount,
      monthlyCost: subscription.monthlyCost,
    })),
    anomalyCounts: countAnomalies(input.anomalies),
  };
}

/**
 * Run the aggregate through the same redaction layer as merchant prompts.
 * The returned text is what a cloud insights call is allowed to contain.
 */
export function redactInsightsAggregate(
  lines: readonly string[],
  aggregate: InsightsAggregate,
): { text: string; report: RedactionReport } {
  const hints = extractHeaderHints(lines);
  const redacted = redactText(JSON.stringify(aggregate, null, 2), hints);
  return { text: redacted.text, report: redacted.report };
}
