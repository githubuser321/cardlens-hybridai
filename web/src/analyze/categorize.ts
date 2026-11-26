import { aggregateTransactions, type Aggregates } from './aggregates';
import { CATEGORIES, isCategory } from './categories';
import { categorizeByRules, isRecurringCharge } from './rules';
import { detectAnomalies, type Anomaly } from '../insights/anomalies';
import { detectSubscriptions, subscriptionIndexes, type Subscription } from '../insights/subscriptions';
import type { InstallmentPlan, ParsedTransaction } from '../parse/statement';
import { CLOUD_FAILED_ALERT, safeTechnicalDetail, type CallOutcome } from '../compliance/cloud-outcome';
import { CloudNotSentError, KEPT_ON_DEVICE_MESSAGE } from '../compliance/errors';
import { prepareCloudMerchantPayload, type CloudMerchantPayload, type RedactionReport } from '../redact/redact';
import { formatInferenceSource, type InferenceSourceTag } from '../inference-source';
import { extractJson, isRecord } from '../text/json';

export const DEFAULT_BATCH_SIZE = 20;

export interface MerchantModel {
  generateContent(prompt: string): Promise<{ text: string; inferenceSource?: string }>;
}

export interface AnalyzedTransaction {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  isRecurring: boolean;
  /** Web-only. Omitted from objects validated against the shared schema. */
  installments: InstallmentPlan | null;
  inferenceSource: InferenceSourceTag;
}

export interface CategorizationCall {
  prompt: string;
  inferenceSource: InferenceSourceTag;
  ok: boolean;
  detail: string;
  outcome: CallOutcome;
  /** Raw failure text for a disclosure. Never the statement. */
  technicalDetail: string | null;
}

export interface AnalysisResult {
  transactions: AnalyzedTransaction[];
  aggregates: Aggregates;
  subscriptions: Subscription[];
  anomalies: Anomaly[];
  payload: CloudMerchantPayload;
  report: RedactionReport;
  /** One entry per model call. Empty when keyword rules ran with no model. */
  calls: CategorizationCall[];
  /** True when generateContent was invoked. False when keyword rules ran with no model. */
  sent: boolean;
  warnings: string[];
}

/**
 * Categorize parsed transactions.
 * Merchant strings are redacted before they are placed in a model prompt.
 * With no model, or when a call fails, keyword rules run on the original merchant locally.
 */
export async function analyzeTransactions(
  transactions: readonly ParsedTransaction[],
  options: {
    lines: readonly string[];
    model?: MerchantModel | null;
    batchSize?: number;
  },
): Promise<AnalysisResult> {
  const prepared = prepareCloudMerchantPayload(
    options.lines,
    transactions.map((transaction) => transaction.merchant),
  );
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const categories = transactions.map((transaction) => categorizeByRules(transaction.merchant));
  const sources: InferenceSourceTag[] = transactions.map(() => 'RULES');
  const warnings: string[] = [];
  const calls: CategorizationCall[] = [];
  let sent = false;
  const model = options.model ?? null;

  if (model && transactions.length > 0) {
    for (let start = 0; start < transactions.length; start += batchSize) {
      const end = Math.min(start + batchSize, transactions.length);
      const merchants = prepared.payload.merchants.slice(start, end);
      const prompt = buildRedactedMerchantPrompt(merchants);
      sent = true;
      try {
        const response = await model.generateContent(prompt);
        const items = parseCategorizationResponse(response.text);
        const source = formatInferenceSource(response.inferenceSource);
        calls.push({
          prompt,
          inferenceSource: source,
          ok: true,
          detail: 'Categorization prompt. Merchants are redacted.',
          outcome: 'ok',
          technicalDetail: null,
        });
        for (let offset = 0; offset < merchants.length; offset += 1) {
          const index = start + offset;
          const merchant = merchants[offset] ?? '';
          const category = categoryAt(offset, merchant, items, merchants.length);
          if (category && isCategory(category)) {
            categories[index] = category;
            sources[index] = source;
          }
        }
      } catch (error) {
        const skipped = error instanceof CloudNotSentError;
        if (skipped) {
          const message = error.message;
          pushOnce(warnings, message);
          calls.push({
            prompt,
            inferenceSource: 'RULES',
            ok: false,
            detail: message,
            outcome: message === KEPT_ON_DEVICE_MESSAGE ? 'declined' : 'blocked',
            technicalDetail: null,
          });
          continue;
        }
        const raw = error instanceof Error ? error.message : 'Hybrid categorization failed';
        const technicalDetail = safeTechnicalDetail(raw, prompt);
        pushOnce(warnings, CLOUD_FAILED_ALERT);
        calls.push({
          prompt,
          inferenceSource: 'RULES',
          ok: false,
          detail: CLOUD_FAILED_ALERT,
          outcome: 'failed',
          technicalDetail,
        });
      }
    }
  }

  const subscriptions = detectSubscriptions(transactions);
  const recurring = subscriptionIndexes(subscriptions);
  const analyzed = transactions.map((transaction, index): AnalyzedTransaction => {
    const category = categories[index] ?? 'other';
    return {
      date: transaction.date,
      merchant: transaction.merchant,
      amount: transaction.amount,
      currency: transaction.currency,
      category,
      isRecurring: isRecurringCharge(category, transaction.installments) || recurring.has(index),
      installments: transaction.installments,
      inferenceSource: sources[index] ?? 'RULES',
    };
  });

  return {
    transactions: analyzed,
    aggregates: aggregateTransactions(analyzed),
    subscriptions,
    anomalies: detectAnomalies(analyzed),
    payload: prepared.payload,
    report: prepared.report,
    calls,
    sent,
    warnings,
  };
}

/** Prompt body. Callers must pass merchants that already went through the redaction layer. */
export function buildRedactedMerchantPrompt(merchants: readonly string[]): string {
  return [
    'Assign each merchant one category from the response schema enum.',
    `Categories: ${CATEGORIES.join(', ')}.`,
    'Return a JSON object {"categorizations":[{"merchant":"...","category":"..."}]} with one item per merchant, same order.',
    'Merchants:',
    ...merchants.map((merchant, index) => `${index + 1}. ${oneLine(merchant)}`),
  ].join('\n');
}

export function parseCategorizationResponse(text: string): { merchant: string; category: string }[] {
  const parsed = extractJson(text);
  const items = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.categorizations)
      ? parsed.categorizations
      : null;
  if (!items) {
    throw new Error('Model response was not categorization JSON');
  }
  return items.map((item) => {
    if (!isRecord(item)) {
      return { merchant: '', category: '' };
    }
    return {
      merchant: typeof item.merchant === 'string' ? item.merchant : '',
      category: typeof item.category === 'string' ? item.category : '',
    };
  });
}

function categoryAt(
  index: number,
  merchant: string,
  items: readonly { merchant: string; category: string }[],
  expectedLength: number,
): string | null {
  if (items.length === expectedLength) {
    return items[index]?.category ?? null;
  }
  const byName = items.find((item) => item.merchant === merchant);
  return byName?.category ?? items[index]?.category ?? null;
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function pushOnce(warnings: string[], message: string): void {
  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}
