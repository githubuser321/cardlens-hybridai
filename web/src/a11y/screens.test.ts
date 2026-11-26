// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { setDemoStatementLink } from '../ui/demo-statement-link';
import { renderOnboarding } from '../ui/render-onboarding';
import { renderDashboard } from '../ui/render-dashboard';
import type { AnalyzedTransaction } from '../analyze/categorize';
import { aggregateTransactions } from '../analyze/aggregates';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.documentElement.lang = 'en';
  document.title = 'CardLens';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

const axeOptions: axe.RunOptions = {
  rules: {
    // jsdom does not compute layout, so color contrast is checked in contrast.test.ts.
    'color-contrast': { enabled: false },
  },
};

async function expectNoViolations(): Promise<void> {
  const results = await axe.run(document, axeOptions);
  const summary = results.violations.map((violation) => {
    const nodes = violation.nodes.map((node) => node.target.join(' ')).join(', ');
    return `${violation.id}: ${violation.help} [${nodes}]`;
  });
  expect(summary).toEqual([]);
}

describe('main screen accessibility', () => {
  it('exposes landmarks, names, and a live onboarding region before a statement is loaded', async () => {
    mountApp();
    expect(document.querySelector('header')).not.toBeNull();
    expect(document.querySelector('main#main')).not.toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
    expect(document.querySelector('a.skip')?.getAttribute('href')).toBe('#main');
    expect(document.querySelector('label[for="category-filter"]')?.textContent).toMatch(/category/i);
    expect(document.querySelector('label[for="onboarding-meter"]')).not.toBeNull();
    expect(document.querySelector('#onboarding-status')?.getAttribute('aria-live')).toBe('polite');
    expect(document.querySelector('#download-model')?.textContent).toMatch(/download/i);
    expect(document.querySelector('#load-sample') instanceof HTMLButtonElement).toBe(true);
    expect(document.querySelector('#load-demo')?.textContent).toMatch(/demo statement/i);
    expect(document.querySelector('#load-demo-scan')?.textContent).toMatch(/scanned image/i);
    expect(document.getElementById('demo-statement-view')?.hidden).toBe(true);
    expect(document.getElementById('session-cloud-on')?.textContent).toMatch(/Turn cloud back on/);
    await expectNoViolations();
  });

  it('keeps View demo statement accessible after the demo PDF is chosen', async () => {
    mountApp();
    setDemoStatementLink(document, true);
    const link = document.querySelector('#view-demo-statement');
    expect(link?.getAttribute('href')).toBe('/demo/demo-statement.pdf');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.textContent).toMatch(/View demo statement/);
    expect(link?.textContent).not.toMatch(/click here/i);
    await expectNoViolations();
  });

  it('keeps the dashboard, comparison, and download progress free of axe violations', async () => {
    mountApp();
    const transactions: AnalyzedTransaction[] = [
      transaction('2026-01-09', 'שופרסל דיל', 100, 'groceries'),
      transaction('2026-02-09', 'שופרסל דיל', 180, 'groceries'),
      transaction('2026-02-05', 'NETFLIX.COM', 54.9, 'subscriptions'),
    ];
    renderDashboard({
      status: 'Sample statement: 3 transactions. Categorized with on-device keyword rules.',
      transactions,
      aggregates: aggregateTransactions(transactions),
      subscriptions: [{
        merchant: 'NETFLIX.COM',
        normalizedMerchant: 'netflix.com',
        cadence: 'monthly',
        currency: 'ILS',
        occurrenceCount: 1,
        monthlyCost: 54.9,
        transactionIndexes: [2],
      }],
      anomalies: [],
      insights: {
        summary: 'Three sample transactions.',
        insights: ['Groceries were higher this month.'],
        inferenceSource: 'RULES',
        note: 'Local template. Nothing was sent.',
      },
    });
    renderOnboarding({
      availability: 'downloading',
      nag: true,
      progress: 0.42,
      error: null,
    });

    const merchant = document.querySelector('#transaction-rows .tx-who-stack span[dir="auto"]');
    expect(merchant?.getAttribute('dir')).toBe('auto');
    expect(merchant?.textContent).toContain('שופרסל');
    expect(document.querySelector('#compare-status')?.textContent).toMatch(/versus/i);
    expect(document.querySelector('#compare-chart .tag')?.textContent).toMatch(/Up|New/);
    const meter = document.querySelector('#onboarding-meter');
    expect(meter?.getAttribute('aria-valuenow')).toBe('42');
    expect(document.querySelector('#onboarding-progress')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('#insights-list li')?.getAttribute('dir')).toBe('auto');
    await expectNoViolations();

    renderOnboarding({
      availability: 'not-supported',
      nag: true,
      progress: null,
      error: null,
    });
    expect(document.querySelector('#onboarding')?.classList.contains('is-compact')).toBe(true);
    expect(document.querySelector('#onboarding-requirements')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('#onboarding-status')?.textContent).toMatch(/basic sorting/i);
    expect(document.querySelector('#download-model')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('#dismiss-onboarding')?.hasAttribute('hidden')).toBe(true);
    await expectNoViolations();
  });
});

function transaction(date: string, merchant: string, amount: number, category: string): AnalyzedTransaction {
  return {
    date,
    merchant,
    amount,
    currency: 'ILS',
    category,
    isRecurring: category === 'subscriptions',
    installments: null,
    inferenceSource: 'RULES',
  };
}
