// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnalyzedTransaction } from '../analyze/categorize';
import { aggregateTransactions } from '../analyze/aggregates';
import type { Anomaly } from '../insights/anomalies';
import { createCloudLog } from '../cloud-log';
import { renderCloudLog } from './render-cloud-log';
import { renderDashboard } from './render-dashboard';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

function transaction(date: string, merchant: string, amount: number): AnalyzedTransaction {
  return {
    date,
    merchant,
    amount,
    currency: 'USD',
    category: 'shopping',
    isRecurring: false,
    installments: null,
    inferenceSource: 'RULES',
  };
}

describe('dashboard layout', () => {
  it('collapses repeated new merchants, shows a total, and keeps the payload closed', () => {
    mountApp();
    const transactions = [
      transaction('2026-01-02', 'Harbor Grocery', 20),
      transaction('2026-02-02', 'North Books', 12),
      transaction('2026-02-03', 'West Cafe', 9),
      transaction('2026-02-04', 'East Market', 15),
    ];
    const anomalies: Anomaly[] = [
      anomaly(1, 'North Books'),
      anomaly(2, 'West Cafe'),
      anomaly(3, 'East Market'),
    ];
    renderDashboard({
      status: 'Demo: 4 transactions. Categorized with on-device keyword rules. Nothing was sent to the cloud.',
      transactions,
      aggregates: aggregateTransactions(transactions),
      subscriptions: [],
      anomalies,
      insights: {
        summary: 'Four fictional charges.',
        insights: ['Shopping led the month.'],
        inferenceSource: 'RULES',
        note: 'Local template.',
      },
      cloudAsk: 'failed',
      cloudDetail: 'App Check token is invalid (AI/fetch-error) https://example.invalid/token',
    });

    expect(document.getElementById('dashboard')?.hidden).toBe(false);
    expect(document.getElementById('metric-total')?.textContent).toMatch(/56\.00/);
    expect(document.getElementById('tab-overview')?.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('panel-transactions')?.hidden).toBe(true);
    const anomalyText = document.getElementById('anomaly-list')?.textContent ?? '';
    expect(anomalyText).toContain('New merchants · 3');
    expect(anomalyText.match(/New merchant/g)).toHaveLength(1);

    const alert = document.getElementById('cloud-fallback');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.hidden).toBe(false);
    expect(alert?.textContent).toContain("Cloud analysis isn't available right now");
    expect(document.getElementById('cloud-fallback-message')?.textContent).not.toMatch(/https?:\/\//);
    expect(document.getElementById('cloud-fallback-detail')?.textContent).toMatch(/https:\/\/example\.invalid/);
    expect(document.querySelector('#result-chip-row')?.textContent).toMatch(/Basic sorting/);
    expect(document.getElementById('result-disclaimer')?.textContent).toBe('Sorted by keywords – may contain mistakes');

    const row = document.querySelector('#transaction-rows tr');
    expect(row?.classList.contains('tx')).toBe(true);
    expect(row?.querySelector('.tx-date')?.textContent).toBe('Jan 2, 2026');
    expect(row?.querySelector('.chip')?.textContent).toBe('Shopping');

    (document.getElementById('tab-transactions') as HTMLButtonElement).click();
    expect(document.getElementById('panel-transactions')?.hidden).toBe(false);
    expect(document.getElementById('panel-overview')?.hidden).toBe(true);

    const log = createCloudLog(() => new Date('2026-03-01T00:00:00.000Z'));
    log.record({
      purpose: 'categorization',
      inferenceSource: 'RULES',
      sentToCloud: false,
      report: { findings: [], total: 0 },
      payloadText: '{"prompt":"long json"}',
      note: 'Keyword rules ran on this device.',
    });
    renderCloudLog(log.list());
    const payload = document.querySelector('#cloud-log details.payload');
    expect(payload).toBeInstanceOf(HTMLDetailsElement);
    expect((payload as HTMLDetailsElement).open).toBe(false);
    expect(payload?.querySelector('summary')?.textContent).toBe('View exact payload');
    expect(payload?.querySelector('pre')?.textContent).toContain('long json');
  });

  it('counts one-month subscription charges and keeps the category pill in its cell', () => {
    mountApp();
    const charges = [
      ['Netflix', 15.49],
      ['Spotify', 11.99],
      ['iCloud+', 2.99],
      ['ChatGPT Plus', 20],
    ] as const;
    renderDashboard({
      status: 'Demo statement: 4 transactions sorted on this device. Nothing was sent.',
      transactions: charges.map(([merchant, amount]) => ({
        ...transaction('2026-10-01', merchant, amount),
        category: 'subscriptions',
        isRecurring: true,
      })),
      aggregates: aggregateTransactions(charges.map(([merchant, amount]) => ({
        ...transaction('2026-10-01', merchant, amount),
        category: 'subscriptions',
        isRecurring: true,
      }))),
      subscriptions: [],
      anomalies: [],
      insights: {
        summary: 'Four subscriptions.',
        insights: [],
        inferenceSource: 'RULES',
        note: 'Written on this device. No AI was used.',
      },
    });
    expect(document.getElementById('summary-subs')?.textContent).toBe('4 subscriptions, $50.47/mo');
    const listed = document.querySelectorAll('#subscription-list li');
    expect(listed).toHaveLength(4);
    const chip = document.querySelector('#transaction-rows .chip');
    expect(chip?.closest('td')?.classList.contains('tx-chips')).toBe(true);
    expect(chip?.closest('td')?.classList.contains('tx-who')).toBe(false);
  });

  it('keeps overflow rules and developer jargon out of the first screen', () => {
    const css = readFileSync(path.resolve('src/style.css'), 'utf8');
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toMatch(/pre[\s\S]*overflow-x:\s*auto/);
    expect(html).not.toContain('shared/schema');
    expect(html).not.toContain('no Firebase config');
    expect(html).toContain('Try demo statement');
    expect(html).toContain('id="hybrid-demo" hidden');
  });
});

function anomaly(index: number, merchant: string): Anomaly {
  return {
    kind: 'new_merchant',
    index,
    merchant,
    amount: 10,
    currency: 'USD',
    date: '2026-02-02',
    reason: 'First time this merchant appears, in the latest month of this statement.',
  };
}
