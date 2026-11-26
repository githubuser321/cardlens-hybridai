import type { Aggregates } from '../analyze/aggregates';
import { safeTechnicalDetail, type CallOutcome } from '../compliance/cloud-outcome';
import { CloudNotSentError, KEPT_ON_DEVICE_MESSAGE } from '../compliance/errors';
import { formatInferenceSource, type InferenceSourceTag } from '../inference-source';
import type { RedactionReport } from '../redact/redact';
import { extractJson, isRecord } from '../text/json';
import type { Anomaly } from './anomalies';
import { buildInsightsAggregate, redactInsightsAggregate } from './payload';
import { subscriptionsForDisplay, type DisplaySubscriptionSource, type Subscription } from './subscriptions';
import { localInsights } from './template';

export interface InsightsModel {
  generateContent(prompt: string): Promise<{ text: string; inferenceSource?: string }>;
}

export interface InsightsResult {
  summary: string;
  insights: string[];
  /** Source badge for the text shown in the insights panel. */
  inferenceSource: InferenceSourceTag;
  /** Source reported by the model call, when that call returned. */
  callSource: InferenceSourceTag | null;
  sentToCloud: boolean;
  payloadText: string;
  report: RedactionReport;
  note: string;
  outcome: CallOutcome | 'skipped';
  /** Raw failure text for a disclosure. Null when there is nothing technical to show. */
  detail: string | null;
}

export function buildInsightsPrompt(redactedAggregateJson: string): string {
  return [
    'Summarize these redacted card-statement aggregates.',
    'Use only this JSON. Do not invent merchants, amounts, or transactions.',
    'Return JSON {"summary":"one or two sentences","insights":["short observation"]}.',
    'Write at most 4 insights.',
    'Aggregate:',
    redactedAggregateJson,
  ].join('\n');
}

export function parseInsightsResponse(text: string): { summary: string; insights: string[] } {
  const parsed = extractJson(text);
  if (!isRecord(parsed) || typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('Model response was not insights JSON');
  }
  if (!Array.isArray(parsed.insights)) {
    throw new Error('Model response was not insights JSON');
  }
  const insights = parsed.insights
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  if (insights.length === 0) {
    throw new Error('Model response was not insights JSON');
  }
  return { summary: parsed.summary.trim(), insights };
}

/**
 * Insights model is on-device first, then cloud.
 * A thrown call or unusable JSON falls back to the local template (`RULES`).
 * An on-device result is not treated as sent.
 */
export async function createInsights(options: {
  lines: readonly string[];
  aggregates: Aggregates;
  subscriptions: readonly Subscription[];
  /** Same charges the summary uses when recurrence detection finds nothing. */
  transactions?: readonly DisplaySubscriptionSource[];
  anomalies: readonly Anomaly[];
  model?: InsightsModel | null;
  online?: boolean;
}): Promise<InsightsResult> {
  const subscriptions = subscriptionsForDisplay(options.subscriptions, options.transactions ?? []);
  const aggregate = buildInsightsAggregate({ ...options, subscriptions });
  const redacted = redactInsightsAggregate(options.lines, aggregate);
  const local = localInsights({ ...options, subscriptions });
  const online = options.online !== false;
  const model = options.model ?? null;
  const shared = { payloadText: redacted.text, report: redacted.report };

  if (!model) {
    return {
      ...shared,
      summary: local.summary,
      insights: local.insights,
      inferenceSource: 'RULES',
      callSource: null,
      sentToCloud: false,
      outcome: 'skipped',
      detail: null,
      note: 'Written on this device. No AI was used.',
    };
  }

  try {
    const response = await model.generateContent(buildInsightsPrompt(redacted.text));
    const callSource = formatInferenceSource(response.inferenceSource);
    const sentToCloud = callSource === 'IN_CLOUD';
    if (!online && sentToCloud) {
      return {
        ...shared,
        summary: local.summary,
        insights: local.insights,
        inferenceSource: 'RULES',
        callSource,
        sentToCloud: true,
        outcome: 'blocked',
        detail: null,
        note: 'The browser is offline, so the cloud insights text was not used. Local template shown.',
      };
    }
    try {
      const parsed = parseInsightsResponse(response.text);
      return {
        ...shared,
        summary: parsed.summary,
        insights: parsed.insights,
        inferenceSource: callSource,
        callSource,
        sentToCloud,
        outcome: 'ok',
        detail: null,
        note: insightsCallNote(callSource),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Insights response was unusable';
      return {
        ...shared,
        summary: local.summary,
        insights: local.insights,
        inferenceSource: 'RULES',
        callSource,
        sentToCloud,
        outcome: 'failed',
        detail: safeTechnicalDetail(message),
        note: sentToCloud
          ? 'Local template shown. The cloud response could not be used.'
          : 'Local template shown.',
      };
    }
  } catch (error) {
    if (error instanceof CloudNotSentError) {
      return {
        ...shared,
        summary: local.summary,
        insights: local.insights,
        inferenceSource: 'RULES',
        callSource: null,
        sentToCloud: false,
        outcome: error.message === KEPT_ON_DEVICE_MESSAGE ? 'declined' : 'blocked',
        detail: null,
        note: error.message,
      };
    }
    const raw = error instanceof Error ? error.message : 'Insights call failed';
    return {
      ...shared,
      summary: local.summary,
      insights: local.insights,
      inferenceSource: 'RULES',
      callSource: null,
      sentToCloud: false,
      outcome: 'failed',
      detail: safeTechnicalDetail(raw, redacted.text),
      note: 'Local template shown.',
    };
  }
}

function insightsCallNote(source: InferenceSourceTag): string {
  if (source === 'ON_DEVICE') {
    return 'Insights ran on this device.';
  }
  if (source === 'IN_CLOUD') {
    return 'Insights ran in the cloud after on-device inference was unavailable. The body is the redacted aggregate only.';
  }
  return 'Insights used the local template. The body is the redacted aggregate only.';
}
