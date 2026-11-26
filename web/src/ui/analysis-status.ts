import type { CallOutcome } from '../compliance/cloud-outcome';
import { CLOUD_FAILED_ALERT } from '../compliance/cloud-outcome';
import { CHIP_CLOUD_EN, CHIP_DEVICE_EN } from '../compliance/copy';
import type { InferenceSourceTag } from '../inference-source';

export type CloudAskState = 'declined' | 'failed' | 'not-asked' | 'sent';

export interface AnalysisCopy {
  status: string;
  alert: string | null;
}

export function cloudAskFrom(input: {
  outcomes: readonly CallOutcome[];
  sentToCloud: boolean;
  insightsOutcome: CallOutcome | 'skipped';
}): CloudAskState {
  if (input.sentToCloud) {
    return 'sent';
  }
  if (input.outcomes.includes('failed') || input.insightsOutcome === 'failed') {
    return 'failed';
  }
  if (input.outcomes.includes('declined') || input.insightsOutcome === 'declined') {
    return 'declined';
  }
  return 'not-asked';
}

export function badgeForCloudAsk(state: CloudAskState): { label: string; source: string; state: CloudAskState } {
  switch (state) {
    case 'sent':
      return { label: CHIP_CLOUD_EN, source: 'IN_CLOUD', state };
    case 'failed':
      return { label: 'Cloud unavailable', source: 'RULES', state };
    case 'declined':
      return { label: 'Nothing left your device', source: 'LOCAL', state };
    default:
      return { label: CHIP_DEVICE_EN, source: 'ON_DEVICE', state };
  }
}

export function insightsSentence(source: InferenceSourceTag, sentToCloud: boolean): string {
  if (source === 'ON_DEVICE') {
    return 'Insights ran on this device.';
  }
  if (sentToCloud || source === 'IN_CLOUD') {
    return 'Cloud insights used the redacted aggregate.';
  }
  if (source === 'RULES') {
    return 'Insights were written on this device from local rules.';
  }
  return 'Insights were written on this device.';
}

/**
 * One status line, and at most one "nothing was sent" sentence.
 * The cloud-failure alert carries that sentence when rules were the fallback.
 */
export function composeAnalysisCopy(input: {
  label: string;
  count: number;
  sources: readonly InferenceSourceTag[];
  cloudAsk: CloudAskState;
  insightsSentence: string;
}): AnalysisCopy {
  if (input.count === 0) {
    return {
      status: `${input.label}: no transactions found. Header rows and totals are skipped.`,
      alert: null,
    };
  }
  const tags = new Set(input.sources);
  if (input.cloudAsk === 'not-asked' && tags.has('RULES') && !tags.has('IN_CLOUD') && !tags.has('ON_DEVICE')) {
    return {
      status: `${input.label}: ${input.count} transactions sorted on this device. Nothing was sent.`,
      alert: null,
    };
  }
  const how = tags.has('ON_DEVICE') && !tags.has('IN_CLOUD')
    ? 'Sorted on this device.'
    : tags.has('IN_CLOUD')
      ? 'Sorted in the cloud after you agreed. The text was redacted.'
      : 'Sorted on this device.';
  const delivery = input.cloudAsk === 'sent'
    ? 'The cloud received the redacted merchant text you previewed.'
    : input.cloudAsk === 'not-asked'
      ? 'Nothing was sent.'
      : '';
  const insight = input.cloudAsk === 'failed' ? '' : input.insightsSentence.trim();
  const status = [`${input.label}: ${input.count} transactions.`, how, delivery, insight]
    .filter((part) => part.length > 0)
    .join(' ');
  const alert = input.cloudAsk === 'failed' ? CLOUD_FAILED_ALERT : null;
  return { status, alert };
}

/** Count sentences that tell the reader nothing left the device. */
export function notSentMentions(text: string): number {
  const matches = text.match(/nothing (?:from your statement )?was sent|\b(?:was|were) not sent/gi);
  return matches?.length ?? 0;
}
