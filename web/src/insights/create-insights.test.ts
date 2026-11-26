import { describe, expect, it } from 'vitest';
import { aggregateTransactions } from '../analyze/aggregates';
import { analyzeTransactions } from '../analyze/categorize';
import type { ParsedTransaction } from '../parse/statement';
import { createInsights, parseInsightsResponse } from './create-insights';
import { localInsights } from './template';

const lines = [
  'לכבוד: דנה לוי',
  'כרטיס: 4111-1111-1111-1111',
  'טלפון: 050-1234567',
];

function parsed(partial: Partial<ParsedTransaction> & Pick<ParsedTransaction, 'date' | 'merchant' | 'amount'>): ParsedTransaction {
  return {
    currency: 'ILS',
    installments: null,
    ...partial,
  };
}

describe('createInsights', () => {
  it('stays local and redacts the aggregate when no model is configured', async () => {
    const rows = [
      parsed({ date: '2025-12-05', merchant: 'NETFLIX דנה לוי 4111111111111111', amount: 54.9 }),
      parsed({ date: '2026-01-05', merchant: 'NETFLIX דנה לוי 4111111111111111', amount: 54.9 }),
      parsed({ date: '2026-02-05', merchant: 'NETFLIX דנה לוי 4111111111111111', amount: 54.9 }),
      parsed({ date: '2026-03-11', merchant: 'עמלת כרטיס', amount: 15 }),
    ];
    const analysis = await analyzeTransactions(rows, { lines, model: null });
    const insights = await createInsights({
      lines,
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      anomalies: analysis.anomalies,
      model: null,
      online: false,
    });
    expect(insights.sentToCloud).toBe(false);
    expect(insights.inferenceSource).toBe('RULES');
    expect(insights.summary).toMatch(/4 transactions/);
    expect(insights.payloadText).not.toContain('דנה לוי');
    expect(insights.payloadText).not.toContain('4111111111111111');
    expect(insights.payloadText).not.toContain('050-1234567');
    expect(insights.payloadText).toContain('[REDACTED_NAME]');
    expect(insights.payloadText).not.toContain('עמלת כרטיס');
    expect(insights.report.total).toBeGreaterThan(0);
  });

  it('sends only the redacted aggregate and tags the cloud source', async () => {
    const rows = [
      parsed({ date: '2026-03-01', merchant: 'שופרסל דיל', amount: 80 }),
      parsed({ date: '2026-03-06', merchant: 'AMAZON.COM', amount: 29.99, currency: 'USD' }),
    ];
    const analysis = await analyzeTransactions(rows, { lines, model: null });
    const prompts: string[] = [];
    const insights = await createInsights({
      lines,
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      anomalies: analysis.anomalies,
      online: true,
      model: {
        async generateContent(prompt: string) {
          prompts.push(prompt);
          return {
            text: '{"summary":"Two currencies.","insights":["Groceries lead.","One foreign charge."]}',
            inferenceSource: 'in_cloud',
          };
        },
      },
    });
    expect(prompts).toHaveLength(1);
    const prompt = prompts[0] ?? '';
    expect(prompt).not.toContain('דנה לוי');
    expect(prompt).not.toContain('4111');
    expect(prompt).not.toContain('שופרסל');
    expect(prompt).not.toContain('AMAZON.COM');
    expect(prompt).toContain('categoryTotals');
    expect(prompt).toContain('anomalyCounts');
    expect(insights.inferenceSource).toBe('IN_CLOUD');
    expect(insights.sentToCloud).toBe(true);
    expect(insights.summary).toBe('Two currencies.');
    expect(insights.insights).toEqual(['Groceries lead.', 'One foreign charge.']);
  });

  it('falls back to the template when the model fails or returns junk', async () => {
    const aggregates = aggregateTransactions([]);
    const failed = await createInsights({
      lines: [],
      aggregates,
      subscriptions: [],
      anomalies: [],
      online: true,
      model: {
        async generateContent() {
          throw new Error('offline');
        },
      },
    });
    expect(failed.inferenceSource).toBe('RULES');
    expect(failed.sentToCloud).toBe(false);
    expect(failed.outcome).toBe('failed');
    expect(failed.detail).toMatch(/offline/);
    expect(failed.note).not.toMatch(/offline/);
    expect(failed.summary).toMatch(/No transactions/);

    const junk = await createInsights({
      lines: [],
      aggregates: aggregateTransactions([
        { date: '2026-03-01', merchant: 'Shop', amount: 10, currency: 'ILS', category: 'shopping' },
      ]),
      subscriptions: [],
      anomalies: [],
      online: true,
      model: {
        async generateContent() {
          return { text: 'not json', inferenceSource: 'in_cloud' };
        },
      },
    });
    expect(junk.sentToCloud).toBe(true);
    expect(junk.callSource).toBe('IN_CLOUD');
    expect(junk.inferenceSource).toBe('RULES');
    expect(junk.summary).toMatch(/1 transaction/);
  });
});

describe('insights fallback chain', () => {
  const rows = [
    parsed({ date: '2026-03-01', merchant: 'Shop', amount: 10 }),
  ];

  async function run(model: {
    generateContent: (prompt: string) => Promise<{ text: string; inferenceSource?: string }>;
  }) {
    const analysis = await analyzeTransactions(rows, { lines, model: null });
    return createInsights({
      lines,
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      anomalies: analysis.anomalies,
      online: true,
      model,
    });
  }

  it('uses on-device, then cloud, then the local rules template', async () => {
    const onDevice = await run({
      async generateContent() {
        return {
          text: '{"summary":"On device.","insights":["Stayed here."]}',
          inferenceSource: 'on_device',
        };
      },
    });
    expect(onDevice.inferenceSource).toBe('ON_DEVICE');
    expect(onDevice.callSource).toBe('ON_DEVICE');
    expect(onDevice.sentToCloud).toBe(false);
    expect(onDevice.summary).toBe('On device.');
    expect(onDevice.note).toMatch(/on this device/i);
    expect(onDevice.outcome).toBe('ok');

    const cloud = await run({
      async generateContent() {
        return {
          text: '{"summary":"In cloud.","insights":["Aggregate only."]}',
          inferenceSource: 'in_cloud',
        };
      },
    });
    expect(cloud.inferenceSource).toBe('IN_CLOUD');
    expect(cloud.sentToCloud).toBe(true);
    expect(cloud.summary).toBe('In cloud.');

    let calls = 0;
    const rules = await run({
      async generateContent() {
        calls += 1;
        if (calls === 1) {
          throw new Error('on-device unavailable');
        }
        throw new Error('cloud unavailable');
      },
    });
    expect(calls).toBe(1);
    expect(rules.inferenceSource).toBe('RULES');
    expect(rules.sentToCloud).toBe(false);
    expect(rules.summary).toMatch(/1 transaction/);
    expect(rules.outcome).toBe('failed');
    expect(rules.detail).toMatch(/on-device unavailable/);
    expect(rules.note).not.toMatch(/on-device unavailable/);
  });
});

describe('parseInsightsResponse', () => {
  it('accepts a fenced object and rejects an empty insight list', () => {
    expect(parseInsightsResponse('```json\n{"summary":"Hi","insights":["A"]}\n```')).toEqual({
      summary: 'Hi',
      insights: ['A'],
    });
    expect(() => parseInsightsResponse('{"summary":"Hi","insights":[]}')).toThrow(/insights/i);
  });
});

describe('one-month demo subscriptions', () => {
  it('uses the same subscription charges as the summary when recurrence detection is empty', async () => {
    const rows = [
      parsed({ date: '2026-10-01', merchant: 'Netflix', amount: 15.49, currency: 'USD' }),
      parsed({ date: '2026-10-01', merchant: 'Spotify', amount: 11.99, currency: 'USD' }),
      parsed({ date: '2026-10-01', merchant: 'iCloud+', amount: 2.99, currency: 'USD' }),
      parsed({ date: '2026-10-03', merchant: 'ChatGPT Plus', amount: 20, currency: 'USD' }),
    ];
    const analysis = await analyzeTransactions(rows, { lines: [], model: null });
    expect(analysis.subscriptions).toEqual([]);
    const insights = await createInsights({
      lines: [],
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      transactions: analysis.transactions,
      anomalies: analysis.anomalies,
      model: null,
    });
    const line = '4 recurring charges (Netflix, Spotify, iCloud+, ChatGPT Plus), about $50.47 per month.';
    expect(insights.insights[0]).toBe(line);
    expect(insights.insights.join('\n')).not.toContain('No monthly or annual subscriptions were detected.');
    expect(insights.payloadText).toContain('"merchant": "Netflix"');
    expect(insights.payloadText).toContain('"merchant": "ChatGPT Plus"');
    expect(JSON.parse(insights.payloadText).subscriptions).toHaveLength(4);
  });
});

describe('localInsights', () => {
  it('mentions subscriptions and flagged charges', () => {
    const text = localInsights({
      aggregates: aggregateTransactions([
        { date: '2026-02-05', merchant: 'NETFLIX.COM', amount: 54.9, currency: 'ILS', category: 'subscriptions' },
        { date: '2026-03-05', merchant: 'NETFLIX.COM', amount: 54.9, currency: 'ILS', category: 'subscriptions' },
      ]),
      subscriptions: [{
        merchant: 'NETFLIX.COM',
        normalizedMerchant: 'netflix com',
        cadence: 'monthly',
        currency: 'ILS',
        occurrenceCount: 2,
        monthlyCost: 54.9,
        transactionIndexes: [0, 1],
      }],
      anomalies: [{
        kind: 'fee',
        index: 0,
        merchant: 'עמלת כרטיס',
        amount: 15,
        currency: 'ILS',
        date: '2026-03-11',
        reason: 'fee',
      }],
    });
    expect(text.insights.some((line) => line.includes('NETFLIX.COM') && line.includes('54.90'))).toBe(true);
    expect(text.insights.some((line) => line.includes('fee'))).toBe(true);
  });
});
