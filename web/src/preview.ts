import { analyzeTransactions } from './analyze/categorize';
import { CLOUD_DISABLED_MESSAGE } from './app-check-init';
import type { DeviceAvailability } from './device/availability';
import { createInsights } from './insights/create-insights';
import { SAMPLE_STATEMENT_LINES } from './parse/sample-statement';
import { parseStatementLines } from './parse/statement';
import { renderDashboard } from './ui/render-dashboard';
import { renderOnboarding } from './ui/render-onboarding';

const ONBOARDING_PREVIEWS: Record<string, DeviceAvailability> = {
  available: 'available',
  downloading: 'downloading',
  downloadable: 'downloadable',
  unsupported: 'not-supported',
  unknown: 'unknown',
};

/**
 * Dev-only painted states for screenshots. Production builds drop the caller.
 * The statement is the synthetic sample. No live model call is made.
 */
export async function applyDevPreview(search: string): Promise<boolean> {
  const preview = new URLSearchParams(search).get('preview');
  if (!preview) {
    return false;
  }
  if (preview === 'comparison') {
    await renderSample(true);
    return false;
  }
  if (preview === 'appcheck') {
    const banner = document.getElementById('config-status');
    if (banner) {
      banner.textContent = CLOUD_DISABLED_MESSAGE;
      banner.className = 'banner is-warning';
    }
    await renderSample(true);
    return false;
  }
  if (preview === 'comparison-off') {
    await renderSample(false);
    return false;
  }
  const availability = ONBOARDING_PREVIEWS[preview];
  if (!availability) {
    return false;
  }
  renderOnboarding({
    availability,
    nag: availability !== 'available',
    progress: availability === 'downloading' ? 0.42 : null,
    error: null,
  });
  await renderSample(true);
  return true;
}

async function renderSample(monthComparisonEnabled: boolean): Promise<void> {
  const lines = [...SAMPLE_STATEMENT_LINES];
  const parsed = parseStatementLines(lines);
  const analysis = await analyzeTransactions(parsed, { lines, model: null });
  const insights = await createInsights({
    lines,
    aggregates: analysis.aggregates,
    subscriptions: analysis.subscriptions,
    transactions: analysis.transactions,
    anomalies: analysis.anomalies,
    model: null,
    online: false,
  });
  const view = {
    status: `Sample statement: ${analysis.transactions.length} transactions. Categorized with on-device keyword rules. Nothing was sent to the cloud for categorization. Insights were written on this device from local rules.`,
    transactions: analysis.transactions,
    aggregates: analysis.aggregates,
    subscriptions: analysis.subscriptions,
    anomalies: analysis.anomalies,
    insights: {
      summary: insights.summary,
      insights: insights.insights,
      inferenceSource: insights.inferenceSource,
      note: insights.note,
    },
    monthComparisonEnabled,
    notableDeltaPercent: 25,
  };
  renderDashboard(view);
}
