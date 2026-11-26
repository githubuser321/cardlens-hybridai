import type { AnalyzedTransaction } from '../analyze/categorize';
import type { Aggregates } from '../analyze/aggregates';
import { CATEGORIES } from '../analyze/categories';
import { CLOUD_FAILED_ALERT } from '../compliance/cloud-outcome';
import { AI_DISCLAIMER_EN } from '../compliance/copy';
import type { Anomaly } from '../insights/anomalies';
import { subscriptionsForDisplay, type Subscription } from '../insights/subscriptions';
import type { InferenceSourceTag } from '../inference-source';
import { createSourceButton, setSortContext } from './source-badge';
import type { SortContext } from './source-explain';
import { chartTextTable } from './chart-table';
import { renderComparison } from './render-comparison';
import type { CloudAskState } from './analysis-status';
import {
  barWidths,
  filterTransactions,
  formatAnomalyKind,
  formatCategory,
  formatInstallment,
  formatMoney,
  formatMonth,
  formatStatementDate,
} from './format';

export interface DashboardView {
  status: string;
  transactions: AnalyzedTransaction[];
  aggregates: Aggregates;
  subscriptions: Subscription[];
  anomalies: Anomaly[];
  insights: {
    summary: string;
    insights: string[];
    inferenceSource: InferenceSourceTag;
    note: string;
  };
  monthComparisonEnabled?: boolean;
  notableDeltaPercent?: number;
  cloudAsk?: CloudAskState;
  cloudDetail?: string | null;
  sortContext?: SortContext;
  foreignNote?: string | null;
}

export function renderDashboard(view: DashboardView): void {
  const dashboard = document.getElementById('dashboard');
  if (dashboard) {
    dashboard.hidden = false;
    dashboard.classList.remove('is-stale');
  }
  const emptyState = document.getElementById('empty-state');
  if (emptyState) {
    emptyState.hidden = true;
  }
  const stale = document.getElementById('dashboard-stale');
  if (stale) {
    stale.hidden = true;
  }
  document.body.dataset.analysis = view.transactions.length > 0 ? 'ready' : 'empty';
  text('analysis-status', view.status);
  renderCloudAlert(view);
  const metrics = requireElement('metrics');
  metrics.hidden = false;
  text('metric-count', String(view.aggregates.transactionCount));
  fillSpendCard(view);

  const multiCurrency = view.aggregates.currencyTotals.length > 1;
  renderBars(
    requireElement('category-chart'),
    view.aggregates.categoryTotals.map((row) => ({
      label: multiCurrency ? `${formatCategory(row.category)} (${row.currency})` : formatCategory(row.category),
      total: row.total,
      currency: row.currency,
    })),
  );
  renderBars(
    requireElement('month-chart'),
    view.aggregates.monthTotals.map((row) => ({
      label: multiCurrency ? `${formatMonth(row.month)} (${row.currency})` : formatMonth(row.month),
      total: row.total,
      currency: row.currency,
    })),
  );
  renderMerchants(requireElement('top-merchants'), view.aggregates.topMerchants, multiCurrency);
  renderInsights(view);
  renderSubscriptions(view);
  renderAnomalies(view.anomalies);
  renderComparison({
    transactions: view.transactions,
    subscriptions: view.subscriptions,
    enabled: view.monthComparisonEnabled !== false,
    notableDeltaPercent: view.notableDeltaPercent,
  });
  renderResultLabel(view);
  renderFilter(requireSelect('category-filter'));
  renderTransactionRows(view.transactions, 'all', view.anomalies);
  bindDashboardTabs();
  selectDashboardTab('tab-overview');
}

export function markDashboardStale(): void {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard || dashboard.hidden) {
    return;
  }
  dashboard.classList.add('is-stale');
  const stale = document.getElementById('dashboard-stale');
  if (stale) {
    stale.hidden = false;
    stale.textContent = 'This dashboard is from the previous file.';
  }
}

export function resetDashboard(): void {
  const dashboard = document.getElementById('dashboard');
  if (dashboard) {
    dashboard.hidden = true;
    dashboard.classList.remove('is-stale');
    dashboard.setAttribute('aria-busy', 'false');
  }
  document.body.dataset.analysis = 'empty';
  const emptyState = document.getElementById('empty-state');
  if (emptyState) {
    emptyState.hidden = false;
  }
  for (const id of [
    'transaction-rows',
    'insights-list',
    'subscription-list',
    'anomaly-list',
    'top-merchants',
    'category-chart',
    'month-chart',
    'compare-chart',
    'compare-subs',
  ]) {
    document.getElementById(id)?.replaceChildren();
  }
  const metrics = document.getElementById('metrics');
  if (metrics) {
    metrics.hidden = true;
  }
  const stale = document.getElementById('dashboard-stale');
  if (stale) {
    stale.hidden = true;
  }
  const alert = document.getElementById('cloud-fallback');
  if (alert) {
    alert.hidden = true;
  }
  const status = document.getElementById('analysis-status');
  if (status) {
    status.textContent = 'Load a statement to see categories. Nothing is sent until you do.';
  }
  const disclaimer = document.getElementById('result-disclaimer');
  const chipRow = document.getElementById('result-chip-row');
  if (disclaimer) {
    disclaimer.hidden = true;
  }
  if (chipRow) {
    chipRow.hidden = true;
  }
  selectDashboardTab('tab-overview');
}

export function renderTransactionRows(
  transactions: readonly AnalyzedTransaction[],
  category: string,
  anomalies: readonly Anomaly[] = [],
): void {
  const body = requireElement('transaction-rows');
  const empty = requireElement('table-empty');
  const visible = filterTransactions(transactions, category);
  body.replaceChildren();
  empty.hidden = visible.length > 0;
  for (const transaction of visible) {
    const index = transactions.indexOf(transaction);
    body.append(renderRow(transaction, anomalies.filter((anomaly) => anomaly.index === index)));
  }
}

function renderRow(transaction: AnalyzedTransaction, anomalies: readonly Anomaly[]): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'tx';
  row.append(
    whoCell(transaction, anomalies),
    chipsCell(transaction),
    amountCell(transaction.amount, transaction.currency),
  );
  return row;
}

function whoCell(transaction: AnalyzedTransaction, anomalies: readonly Anomaly[]): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'tx-who';
  const stack = document.createElement('div');
  stack.className = 'tx-who-stack';
  const name = document.createElement('span');
  name.dir = 'auto';
  name.textContent = transaction.merchant;
  const date = document.createElement('span');
  date.className = 'tx-date';
  date.textContent = formatStatementDate(transaction.date);
  stack.append(date, name);
  if (transaction.isRecurring) {
    stack.append(sub('Recurring'));
  }
  if (transaction.installments) {
    stack.append(sub(formatInstallment(transaction.installments.current, transaction.installments.total)));
  }
  for (const anomaly of anomalies) {
    stack.append(sub(formatAnomalyKind(anomaly.kind)));
  }
  td.append(stack);
  return td;
}

function chipsCell(transaction: AnalyzedTransaction): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'tx-chips';
  const row = document.createElement('div');
  row.className = 'tx-chip-row';
  const category = document.createElement('span');
  category.className = 'chip';
  category.textContent = formatCategory(transaction.category);
  row.append(category);
  const rowSource = transaction.inferenceSource;
  if (rowSource !== summaryKind && !(summaryKind === 'LOCAL' && rowSource === 'RULES')) {
    row.append(createSourceButton(rowSource));
  }
  td.append(row);
  return td;
}

function sub(value: string): HTMLSpanElement {
  const plan = document.createElement('span');
  plan.className = 'sub';
  plan.textContent = value;
  return plan;
}

function amountCell(amount: number, currency: string): HTMLTableCellElement {
  const td = cell(formatMoney(amount, currency));
  td.className = amount < 0 ? 'num neg tx-amount' : 'num tx-amount';
  return td;
}

function cell(value: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = value;
  return td;
}

function renderBars(
  container: HTMLElement,
  rows: readonly { label: string; total: number; currency: string }[],
): void {
  container.replaceChildren();
  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No amounts yet.';
    container.append(empty);
    return;
  }
  const widths = barWidths(rows.map((row) => row.total));
  const list = document.createElement('ul');
  list.className = 'bars';
  rows.forEach((row, index) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'bar-label';
    label.dir = 'auto';
    label.textContent = row.label;
    const track = document.createElement('span');
    track.className = 'bar-track';
    const bar = document.createElement('span');
    bar.className = row.total < 0 ? 'bar is-negative' : 'bar';
    bar.style.width = `${widths[index] ?? 0}%`;
    track.append(bar);
    const value = document.createElement('span');
    value.className = 'bar-value';
    value.textContent = formatMoney(row.total, row.currency);
    item.append(label, track, value);
    list.append(item);
  });
  container.append(list, chartTextTable(
    'Text alternative for this chart',
    'Label',
    'Amount',
    rows.map((row) => ({ label: row.label, value: formatMoney(row.total, row.currency) })),
  ));
}

function renderMerchants(
  container: HTMLElement,
  rows: Aggregates['topMerchants'],
  multiCurrency: boolean,
): void {
  container.replaceChildren();
  if (rows.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No merchants yet.';
    container.append(empty);
    return;
  }
  for (const row of rows) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.dir = 'auto';
    name.textContent = multiCurrency ? `${row.merchant} (${row.currency})` : row.merchant;
    const value = document.createElement('span');
    value.textContent = formatMoney(row.total, row.currency);
    item.append(name, value);
    container.append(item);
  }
}

function renderFilter(select: HTMLSelectElement): void {
  const current = select.value || 'all';
  select.replaceChildren();
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'All categories';
  select.append(all);
  for (const category of CATEGORIES) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = formatCategory(category);
    select.append(option);
  }
  select.value = [...select.options].some((option) => option.value === current) ? current : 'all';
}

function renderInsights(view: DashboardView): void {
  text('insights-summary', view.insights.summary);
  text('insights-note', view.insights.note);
  const list = requireElement('insights-list');
  list.replaceChildren();
  if (view.insights.insights.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No insights for this statement.';
    list.append(item);
    return;
  }
  for (const insight of view.insights.insights) {
    const item = document.createElement('li');
    item.dir = 'auto';
    item.textContent = insight;
    list.append(item);
  }
}

function renderSubscriptions(view: DashboardView): void {
  const total = requireElement('subscription-total');
  const list = requireElement('subscription-list');
  const rows = statementSubscriptions(view);
  list.replaceChildren();
  if (rows.length === 0) {
    total.textContent = 'No subscriptions spotted';
    return;
  }
  const subTotal = rows.reduce((sum, row) => sum + row.monthlyCost, 0);
  total.textContent = `${rows.length} subscriptions, ${formatMoney(subTotal, rows[0]?.currency ?? 'USD')}/mo`;
  for (const subscription of rows) {
    const item = document.createElement('li');
    item.className = 'pair';
    const name = document.createElement('span');
    name.dir = 'auto';
    name.textContent = subscription.merchant;
    const value = document.createElement('span');
    value.textContent = `${formatMoney(subscription.monthlyCost, subscription.currency)} / month`;
    item.append(name, value);
    list.append(item);
  }
}

function statementSubscriptions(view: DashboardView): { merchant: string; monthlyCost: number; currency: string }[] {
  return subscriptionsForDisplay(view.subscriptions, view.transactions).map((row) => ({
    merchant: row.merchant,
    monthlyCost: row.monthlyCost,
    currency: row.currency,
  }));
}

function renderAnomalies(anomalies: readonly Anomaly[]): void {
  const list = requireElement('anomaly-list');
  list.replaceChildren();
  const newcomers = anomalies.filter((anomaly) => anomaly.kind === 'new_merchant');
  const rest = anomalies.filter((anomaly) => anomaly.kind !== 'new_merchant');
  if (newcomers.length === 0 && rest.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No unusual charges, duplicates, new merchants, foreign-currency charges, or fees.';
    list.append(item);
    return;
  }
  if (newcomers.length >= 2) {
    list.append(renderNewMerchantGroup(newcomers));
  } else {
    for (const anomaly of newcomers) {
      list.append(renderAnomalyItem(anomaly));
    }
  }
  for (const anomaly of rest) {
    list.append(renderAnomalyItem(anomaly));
  }
}

function renderNewMerchantGroup(anomalies: readonly Anomaly[]): HTMLLIElement {
  const item = document.createElement('li');
  const title = document.createElement('span');
  title.textContent = `New merchants · ${anomalies.length}`;
  const reason = document.createElement('span');
  reason.className = 'sub';
  reason.textContent = 'These merchants appear for the first time in the latest month.';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Show merchants';
  const inner = document.createElement('ul');
  inner.className = 'stack';
  for (const anomaly of anomalies) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.dir = 'auto';
    name.textContent = `${anomaly.merchant} · ${formatStatementDate(anomaly.date)} · ${formatMoney(anomaly.amount, anomaly.currency)}`;
    row.append(name);
    inner.append(row);
  }
  details.append(summary, inner);
  item.append(title, reason, details);
  return item;
}

function renderAnomalyItem(anomaly: Anomaly): HTMLLIElement {
  const item = document.createElement('li');
  const title = document.createElement('span');
  title.dir = 'auto';
  title.textContent = `${formatAnomalyKind(anomaly.kind)} · ${formatStatementDate(anomaly.date)} · ${anomaly.merchant} · ${formatMoney(anomaly.amount, anomaly.currency)}`;
  const reason = document.createElement('span');
  reason.className = 'sub';
  reason.textContent = anomaly.reason;
  item.append(title, reason);
  return item;
}

function renderResultLabel(view: DashboardView): void {
  const disclaimer = document.getElementById('result-disclaimer');
  const row = document.getElementById('result-chip-row');
  if (!disclaimer || !row) {
    return;
  }
  if (view.sortContext) {
    setSortContext(view.sortContext);
  }
  summaryKind = summarySource(view);
  row.replaceChildren(createSourceButton(summaryKind));
  const ai = summaryKind === 'ON_DEVICE' || summaryKind === 'IN_CLOUD';
  disclaimer.hidden = false;
  disclaimer.textContent = ai
    ? AI_DISCLAIMER_EN
    : 'Sorted by keywords – may contain mistakes';
  const improve = document.getElementById('improve-cloud');
  if (improve instanceof HTMLElement) {
    improve.hidden = summaryKind === 'IN_CLOUD';
  }
}

function summarySource(view: DashboardView): InferenceSourceTag | 'LOCAL' {
  if (view.cloudAsk === 'declined') {
    return 'LOCAL';
  }
  const sources = new Set(view.transactions.map((transaction) => transaction.inferenceSource));
  if (sources.has('IN_CLOUD') || view.insights.inferenceSource === 'IN_CLOUD') {
    return 'IN_CLOUD';
  }
  if (sources.has('ON_DEVICE') || view.insights.inferenceSource === 'ON_DEVICE') {
    return 'ON_DEVICE';
  }
  if (sources.has('RULES') || view.insights.inferenceSource === 'RULES') {
    return 'RULES';
  }
  return 'UNKNOWN';
}

function fillSpendCard(view: DashboardView): void {
  const usd = view.aggregates.currencyTotals.find((entry) => entry.currency === 'USD')
    ?? view.aggregates.currencyTotals[0];
  text('metric-total', usd ? formatMoney(usd.total, usd.currency) : '');
  const month = view.aggregates.monthTotals.at(-1)?.month;
  const monthName = month
    ? new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)),
    )
    : '';
  text('summary-month', monthName ? ` in ${monthName}` : '');
  const top = [...view.aggregates.categoryTotals].sort((left, right) => right.total - left.total)[0];
  text('summary-top', top ? `Top category: ${formatCategory(top.category)}` : '');
  const subs = statementSubscriptions(view);
  const subTotal = subs.reduce((sum, row) => sum + row.monthlyCost, 0);
  const currency = subs[0]?.currency ?? usd?.currency ?? 'USD';
  text('summary-subs', subs.length > 0
    ? `${subs.length} subscriptions, ${formatMoney(subTotal, currency)}/mo`
    : 'No subscriptions spotted');
  const foreign = document.getElementById('summary-foreign');
  if (foreign) {
    foreign.hidden = !view.foreignNote;
    foreign.textContent = view.foreignNote ?? '';
  }
  renderStack(view);
}

function renderStack(view: DashboardView): void {
  const stack = document.getElementById('summary-stack');
  if (!stack) {
    return;
  }
  stack.replaceChildren();
  const rows = view.aggregates.categoryTotals.filter((row) => row.total > 0);
  const sum = rows.reduce((total, row) => total + row.total, 0);
  for (const row of rows) {
    const part = document.createElement('span');
    part.className = 'stack-part';
    part.dataset.category = row.category;
    part.style.flexGrow = String(sum > 0 ? row.total / sum : 0);
    part.title = formatCategory(row.category);
    stack.append(part);
  }
}

function renderCloudAlert(view: DashboardView): void {
  const box = document.getElementById('cloud-fallback');
  const message = document.getElementById('cloud-fallback-message');
  const extra = document.getElementById('cloud-fallback-detail');
  const disclosure = document.getElementById('cloud-fallback-details');
  if (!box || !message || !extra) {
    return;
  }
  const failed = view.cloudAsk === 'failed';
  box.hidden = !failed;
  message.textContent = failed ? CLOUD_FAILED_ALERT : '';
  const technical = view.cloudDetail?.trim() ?? '';
  extra.textContent = failed ? technical : '';
  if (disclosure) {
    disclosure.hidden = !failed || technical.length === 0;
  }
}

const DASHBOARD_TABS = [
  { id: 'tab-overview', panel: 'panel-overview' },
  { id: 'tab-subscriptions', panel: 'panel-subscriptions' },
  { id: 'tab-transactions', panel: 'panel-transactions' },
] as const;

let summaryKind: InferenceSourceTag | 'LOCAL' = 'RULES';

function bindDashboardTabs(): void {
  const buttons = DASHBOARD_TABS
    .map((tab) => document.getElementById(tab.id))
    .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement);
  if (buttons.length !== DASHBOARD_TABS.length || buttons[0]?.dataset.bound === 'true') {
    return;
  }
  for (const button of buttons) {
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      selectDashboardTab(button.id);
    });
  }
}

function selectDashboardTab(id: string): void {
  for (const tab of DASHBOARD_TABS) {
    const button = document.getElementById(tab.id);
    const panel = document.getElementById(tab.panel);
    const selected = tab.id === id;
    if (button) {
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    }
    if (panel) {
      panel.hidden = !selected;
    }
  }
}

function text(id: string, value: string): void {
  requireElement(id).textContent = value;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element;
}

function requireSelect(id: string): HTMLSelectElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`#${id} is not a select`);
  }
  return element;
}
