import { describe, expect, it } from 'vitest';
import type { ParsedTransaction } from '../parse/statement';
import { CLOUD_FAILED_ALERT } from '../compliance/cloud-outcome';
import {
  analyzeTransactions,
  buildRedactedMerchantPrompt,
  parseCategorizationResponse,
  type MerchantModel,
} from './categorize';

const rows: ParsedTransaction[] = [
  { date: '2026-03-01', merchant: 'שופרסל דיל', amount: 245.9, currency: 'ILS', installments: null },
  { date: '2026-03-02', merchant: 'העברה דנה לוי', amount: 50, currency: 'ILS', installments: null },
  { date: '2026-03-03', merchant: 'SHOP 4111111111111111', amount: 10, currency: 'ILS', installments: null },
  { date: '2026-03-04', merchant: 'IKEA', amount: 400, currency: 'ILS', installments: { current: 3, total: 12 } },
  { date: '2026-03-05', merchant: 'NETFLIX.COM', amount: 54.9, currency: 'ILS', installments: null },
];

const lines = [
  'לכבוד: דנה לוי',
  'כרטיס: 4111-1111-1111-1111',
  ...rows.map((row) => row.merchant),
];

function modelReturning(source: string, categoryFor: (merchant: string, index: number) => string): MerchantModel & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    async generateContent(prompt: string) {
      prompts.push(prompt);
      const merchants = [...prompt.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1] ?? '');
      return {
        text: JSON.stringify({
          categorizations: merchants.map((merchant, index) => ({
            merchant,
            category: categoryFor(merchant, index),
          })),
        }),
        inferenceSource: source,
      };
    },
  };
}

describe('analyzeTransactions', () => {
  it('stays on keyword rules and does not send when no model is available', async () => {
    const analysis = await analyzeTransactions(rows, { lines, model: null });
    expect(analysis.sent).toBe(false);
    expect(analysis.transactions.every((row) => row.inferenceSource === 'RULES')).toBe(true);
    expect(analysis.transactions[0]?.category).toBe('groceries');
    expect(analysis.payload.merchants[1]).toBe('העברה [REDACTED_NAME]');
    expect(analysis.payload.merchants[2]).toContain('[REDACTED_PAN]');
    expect(analysis.payload.merchants.join('\n')).not.toContain('4111111111111111');
    expect(analysis.payload.merchants.join('\n')).not.toContain('דנה לוי');
  });

  it('sends only redacted merchants, in batches, and records on-device vs cloud', async () => {
    const onDevice = modelReturning('on_device', () => 'dining');
    const analysis = await analyzeTransactions(rows, { lines, model: onDevice, batchSize: 2 });
    expect(analysis.sent).toBe(true);
    expect(onDevice.prompts).toHaveLength(3);
    const prompt = onDevice.prompts.join('\n');
    expect(prompt).not.toContain('דנה לוי');
    expect(prompt).not.toContain('4111111111111111');
    expect(prompt).not.toContain('245.90');
    expect(prompt).not.toContain('245.9');
    expect(prompt).toContain('[REDACTED_NAME]');
    expect(prompt).toContain('[REDACTED_PAN]');
    expect(prompt).toContain('שופרסל דיל');
    expect(analysis.transactions.every((row) => row.inferenceSource === 'ON_DEVICE')).toBe(true);
    expect(analysis.transactions.every((row) => row.category === 'dining')).toBe(true);
    expect(analysis.transactions[3]?.isRecurring).toBe(true);
    expect(analysis.transactions[4]?.isRecurring).toBe(false);

    const cloud = modelReturning('in_cloud', () => 'groceries');
    const cloudResult = await analyzeTransactions(rows.slice(0, 1), { lines, model: cloud });
    expect(cloudResult.transactions[0]?.inferenceSource).toBe('IN_CLOUD');
    expect(cloudResult.transactions[0]?.category).toBe('groceries');
  });

  it('falls back to rules when the model throws or returns an unknown category', async () => {
    const flaky: MerchantModel = {
      async generateContent() {
        throw new Error('App Check token was rejected');
      },
    };
    const failed = await analyzeTransactions(rows.slice(0, 2), { lines, model: flaky });
    expect(failed.sent).toBe(true);
    expect(failed.warnings[0]).toBe(CLOUD_FAILED_ALERT);
    expect(failed.warnings.join('\n')).not.toMatch(/App Check|https?:\/\//);
    expect(failed.calls[0]?.outcome).toBe('failed');
    expect(failed.calls[0]?.technicalDetail).toMatch(/App Check/);
    expect(failed.transactions.map((row) => row.category)).toEqual(['groceries', 'transfers']);
    expect(failed.transactions.every((row) => row.inferenceSource === 'RULES')).toBe(true);

    const mixed = modelReturning('on_device', (_merchant, index) => (index === 0 ? 'not-a-category' : 'fuel'));
    const partial = await analyzeTransactions(rows.slice(0, 2), { lines, model: mixed, batchSize: 20 });
    expect(partial.transactions[0]).toMatchObject({ category: 'groceries', inferenceSource: 'RULES' });
    expect(partial.transactions[1]).toMatchObject({ category: 'fuel', inferenceSource: 'ON_DEVICE' });
  });
});

describe('parseCategorizationResponse', () => {
  it('accepts a fenced object and a bare array', () => {
    expect(parseCategorizationResponse('```json\n{"categorizations":[{"merchant":"A","category":"fees"}]}\n```')).toEqual([
      { merchant: 'A', category: 'fees' },
    ]);
    expect(parseCategorizationResponse('result: [{"merchant":"B","category":"other"}]')).toEqual([
      { merchant: 'B', category: 'other' },
    ]);
  });
});

describe('buildRedactedMerchantPrompt', () => {
  it('lists merchants and categories and no amounts', () => {
    const prompt = buildRedactedMerchantPrompt(['שופרסל דיל', '[REDACTED_NAME]']);
    expect(prompt).toContain('groceries');
    expect(prompt).toContain('1. שופרסל דיל');
    expect(prompt).not.toContain('amount');
  });
});
