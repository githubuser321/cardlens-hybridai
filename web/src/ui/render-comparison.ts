import { compareMonths, formatDeltaPercent, type ComparedTransaction } from '../compare/months';
import type { Subscription } from '../insights/subscriptions';
import { chartTextTable } from './chart-table';
import { barWidths, formatCadence, formatCategory, formatMoney, formatMonth } from './format';

export function renderComparison(input: {
  transactions: readonly ComparedTransaction[];
  subscriptions: readonly Subscription[];
  enabled?: boolean;
  notableDeltaPercent?: number;
}): void {
  const status = requireElement('compare-status');
  const chart = requireElement('compare-chart');
  const subs = requireElement('compare-subs');
  chart.replaceChildren();
  subs.replaceChildren();

  if (input.enabled === false) {
    status.textContent = 'Month comparison is turned off. Local rules still categorize the statement on this device.';
    subs.append(plainItem('Subscription changes stay hidden while month comparison is off.'));
    return;
  }

  const comparison = compareMonths(
    input.transactions,
    input.subscriptions,
    input.notableDeltaPercent ?? 25,
  );
  if (!comparison) {
    status.textContent = input.transactions.length === 0
      ? 'Load a statement that covers two months to compare them. The comparison stays on this device.'
      : 'This statement covers a single month, so there is no earlier month to compare. This comparison stays on this device.';
    subs.append(plainItem('Subscription changes appear when two months are available.'));
    return;
  }

  const previous = formatMonth(comparison.previousMonth);
  const current = formatMonth(comparison.currentMonth);
  status.textContent = `${current} versus ${previous}. Category amounts are the net of charges and credits. This comparison stays on this device.`;

  const currencies = new Set(comparison.categoryDeltas.map((row) => row.currency));
  if (comparison.categoryDeltas.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No category totals in these months.';
    chart.append(empty);
  } else {
    const widths = barWidths(comparison.categoryDeltas.map((row) => row.deltaAmount));
    const list = document.createElement('ul');
    list.className = 'bars compare-bars';
    list.setAttribute('aria-label', `Category change from ${previous} to ${current}`);
    comparison.categoryDeltas.forEach((row, index) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'bar-label';
      label.dir = 'auto';
      const name = formatCategory(row.category);
      label.textContent = currencies.size > 1 ? `${name} (${row.currency})` : name;
      const track = document.createElement('span');
      track.className = 'bar-track';
      track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('span');
      bar.className = row.deltaAmount < 0 ? 'bar is-negative' : 'bar';
      bar.style.width = `${widths[index] ?? 0}%`;
      track.append(bar);
      const value = document.createElement('span');
      value.className = 'bar-value';
      value.textContent = `${formatSignedMoney(row.deltaAmount, row.currency)} · ${formatDeltaPercent(row.deltaPercent, row.deltaAmount)}`;
      const direction = directionOf(row.deltaAmount, row.deltaPercent);
      const badges = document.createElement('span');
      badges.className = 'badge-row';
      badges.append(badge(direction.label, direction.state));
      if (row.notable) {
        badges.append(badge('Notable', 'notable'));
      }
      item.append(label, track, value, badges);
      list.append(item);
    });
    chart.append(list, chartTextTable(
      `Text alternative for category change from ${previous} to ${current}`,
      'Category',
      'Change',
      comparison.categoryDeltas.map((row) => ({
        label: formatCategory(row.category),
        value: `${formatSignedMoney(row.deltaAmount, row.currency)} ${formatDeltaPercent(row.deltaPercent, row.deltaAmount)}`,
      })),
    ));
  }

  if (comparison.subscriptionChanges.length === 0) {
    subs.append(plainItem(`No subscription started or stopped between ${previous} and ${current}.`));
    return;
  }
  for (const change of comparison.subscriptionChanges) {
    const item = document.createElement('li');
    item.className = 'pair';
    const name = document.createElement('span');
    name.dir = 'auto';
    name.textContent = `${change.merchant} · ${formatCadence(change.cadence)} · ${formatMoney(change.monthlyCost, change.currency)} / month`;
    item.append(name, badge(change.change === 'new' ? 'New' : 'Stopped', change.change));
    subs.append(item);
  }
}

function directionOf(delta: number, percent: number | null): { label: string; state: string } {
  if (delta > 0 && percent === null) {
    return { label: 'New', state: 'new' };
  }
  if (delta > 0) {
    return { label: 'Up', state: 'up' };
  }
  if (delta < 0) {
    return { label: 'Down', state: 'down' };
  }
  return { label: 'Flat', state: 'flat' };
}

function formatSignedMoney(amount: number, currency: string): string {
  const text = formatMoney(amount, currency);
  return amount > 0 ? `+${text}` : text;
}

function badge(label: string, state: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'tag';
  element.dataset.state = state;
  element.textContent = label;
  return element;
}

function plainItem(text: string): HTMLLIElement {
  const item = document.createElement('li');
  item.textContent = text;
  return item;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element;
}
