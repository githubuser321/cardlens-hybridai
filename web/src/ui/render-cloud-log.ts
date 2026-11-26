import type { CloudLogEntry } from '../cloud-log';
import { cloudLogSummary } from '../cloud-log';
import { inferenceBadgeLabel } from '../inference-source';
import { REDACTION_LABELS, type RedactionReport } from '../redact/redact';

const PURPOSE_LABEL: Record<CloudLogEntry['purpose'], string> = {
  categorization: 'Categorization',
  insights: 'Insights',
  scan: 'Scanned page',
};

export function renderCloudLog(entries: readonly CloudLogEntry[]): void {
  text('cloud-sent', cloudLogSummary(entries));
  const list = requireElement('cloud-log');
  const empty = requireElement('cloud-empty');
  list.replaceChildren();
  empty.hidden = entries.length > 0;
  for (const entry of entries) {
    list.append(renderEntry(entry));
  }
}

function renderEntry(entry: CloudLogEntry): HTMLElement {
  const article = document.createElement('article');
  article.className = 'cloud-entry';

  const heading = document.createElement('h3');
  heading.textContent = PURPOSE_LABEL[entry.purpose];

  const meta = document.createElement('p');
  const time = document.createElement('time');
  time.dateTime = entry.at;
  time.textContent = formatStamp(entry.at);
  const badge = document.createElement('span');
  badge.className = 'tag';
  badge.dataset.source = entry.inferenceSource;
  badge.textContent = inferenceBadgeLabel(entry.inferenceSource);
  const sent = document.createElement('span');
  sent.className = 'chip';
  sent.textContent = entry.sentToCloud ? 'Sent to the cloud' : 'Not sent to the cloud';
  meta.append(time, badge, sent);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = entry.note;

  const report = document.createElement('ul');
  report.className = 'report';
  fillReport(report, entry.report);

  const payload = document.createElement('details');
  payload.className = 'payload';
  const summary = document.createElement('summary');
  summary.textContent = 'View exact payload';
  const pre = document.createElement('pre');
  pre.textContent = entry.payloadText;
  payload.append(summary, pre);

  article.append(heading, meta, note, report, payload);
  if (entry.imagePreviewUrl) {
    const image = document.createElement('img');
    image.alt = 'Exact image passed to the model';
    image.src = entry.imagePreviewUrl;
    article.append(image);
  }
  return article;
}

function fillReport(container: HTMLElement, report: RedactionReport): void {
  if (report.findings.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No card numbers, IDs, phones, emails, bank details, names, or addresses were found in this payload.';
    container.append(item);
    return;
  }
  for (const finding of report.findings) {
    const item = document.createElement('li');
    item.textContent = `${REDACTION_LABELS[finding.kind]}: ${finding.count} replaced with ${finding.placeholder}`;
    container.append(item);
  }
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
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
