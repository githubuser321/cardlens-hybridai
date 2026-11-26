import type { InferenceSourceTag } from '../inference-source';
import { explainSorting, SOURCE_LABELS, type SortContext, type SortExplanation } from './source-explain';

const EMPTY_CONTEXT: SortContext = {
  gate: 'remote-on',
  preferenceNever: false,
  sessionOff: false,
  modelUnsupported: false,
  declined: false,
};

let context: SortContext = EMPTY_CONTEXT;
let opener: HTMLElement | null = null;

export function setSortContext(next: SortContext): void {
  context = next;
}

export function sourceButtonLabel(source: InferenceSourceTag | 'LOCAL'): string {
  if (source === 'ON_DEVICE') {
    const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 769px)').matches;
    return wide ? SOURCE_LABELS.ON_DEVICE_DESKTOP : SOURCE_LABELS.ON_DEVICE_MOBILE;
  }
  if (source === 'IN_CLOUD') {
    return SOURCE_LABELS.IN_CLOUD;
  }
  if (source === 'LOCAL') {
    return SOURCE_LABELS.LOCAL;
  }
  if (source === 'UNKNOWN') {
    return SOURCE_LABELS.UNKNOWN;
  }
  return SOURCE_LABELS.RULES;
}

export function createSourceButton(source: InferenceSourceTag | 'LOCAL'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'source-badge';
  button.dataset.source = source;
  button.setAttribute('aria-expanded', 'false');
  button.append(iconFor(source), document.createTextNode(` ${sourceButtonLabel(source)} `), infoMark());
  const open = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    openSortPopover(button, explainSorting(source, context));
  };
  button.addEventListener('click', open);
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    open(event);
  });
  return button;
}

export function openSortPopover(badge: HTMLElement, explanation: SortExplanation = explainSorting(
  (badge.dataset.source as InferenceSourceTag | 'LOCAL') || 'RULES',
  context,
)): void {
  closeSortPopover();
  opener = badge;
  badge.setAttribute('aria-expanded', 'true');
  const dialog = document.createElement('div');
  dialog.id = 'sort-popover';
  dialog.className = 'sort-popover';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'sort-popover-title');
  const title = document.createElement('h2');
  title.id = 'sort-popover-title';
  title.textContent = explanation.title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'sort-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.addEventListener('click', () => closeSortPopover());
  const body = document.createElement('p');
  body.textContent = explanation.body;
  dialog.append(close, title, body);
  if (explanation.action && explanation.actionLabel) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'button-quiet';
    action.textContent = explanation.actionLabel;
    action.addEventListener('click', () => runSortAction(explanation.action, dialog));
    dialog.append(action);
    if (explanation.action === 'browsers') {
      const extra = document.createElement('p');
      extra.id = 'sort-browsers';
      extra.hidden = true;
      extra.textContent = 'Recent Chrome on desktop. Support is still rolling out.';
      dialog.append(extra);
    }
  }
  const backdrop = document.createElement('div');
  backdrop.id = 'sort-backdrop';
  backdrop.className = 'sort-backdrop';
  backdrop.append(dialog);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeSortPopover();
    }
  });
  document.body.append(backdrop);
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSortPopover();
    }
  };
  document.addEventListener('keydown', onKey);
  (dialog as HTMLElement & { release?: () => void }).release = () => {
    document.removeEventListener('keydown', onKey);
  };
  close.focus();
}

export function closeSortPopover(): void {
  const dialog = document.getElementById('sort-popover');
  const release = (dialog as HTMLElement & { release?: () => void } | null)?.release;
  release?.();
  document.getElementById('sort-backdrop')?.remove();
  dialog?.remove();
  document.querySelectorAll('.source-badge[aria-expanded="true"]').forEach((badge) => {
    badge.setAttribute('aria-expanded', 'false');
  });
  opener?.setAttribute('aria-expanded', 'false');
  opener?.focus();
  opener = null;
}

function runSortAction(action: SortExplanation['action'], dialog: HTMLElement): void {
  if (action === 'browsers') {
    const extra = dialog.querySelector('#sort-browsers');
    if (extra instanceof HTMLElement) {
      extra.hidden = false;
    }
    return;
  }
  if (action === 'settings') {
    closeSortPopover();
    window.location.hash = '#settings';
    const choice = document.getElementById('cloud-pref-ask');
    if (choice instanceof HTMLElement) {
      choice.focus();
    }
    return;
  }
  if (action === 'sent') {
    closeSortPopover();
    window.location.hash = '#settings';
    const heading = document.getElementById('what-is-sent-heading');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
    return;
  }
  if (action === 'retry') {
    closeSortPopover();
    document.dispatchEvent(new CustomEvent('cardlens-retry-cloud'));
  }
}

function infoMark(): HTMLSpanElement {
  const mark = document.createElement('span');
  mark.className = 'source-info';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = 'i';
  return mark;
}

function iconFor(source: InferenceSourceTag | 'LOCAL'): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('source-icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', iconPath(source));
  svg.append(path);
  return svg;
}

function iconPath(source: InferenceSourceTag | 'LOCAL'): string {
  if (source === 'ON_DEVICE') {
    return 'M3 2h10v8H3zM6 12h4v2H6z';
  }
  if (source === 'IN_CLOUD') {
    return 'M4 11h8a3 3 0 0 0 .4-6 4 4 0 0 0-7.7-1A3 3 0 0 0 4 11z';
  }
  if (source === 'LOCAL') {
    return 'M8 1l5 2v4c0 3.5-2.2 5.5-5 7-2.8-1.5-5-3.5-5-7V3z';
  }
  if (source === 'UNKNOWN') {
    return 'M8 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z';
  }
  return 'M3 4h10v2H3zM3 8h10v2H3zM3 12h10v2H3z';
}
