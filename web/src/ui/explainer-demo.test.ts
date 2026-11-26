// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CLOUD_TEXT_BODY_EN, FIRST_RUN_EN } from '../compliance/copy';
import { CONSENT_STORAGE_KEY, FIRST_RUN_STORAGE_KEY } from '../compliance/storage-inventory';
import { askDemoTerms, askTextConsent, DEMO_TERMS_AGREE_EN, DEMO_TERMS_CHECK_EN } from './consent-dialog';
import { clearStorage } from '../compliance/clear-data';
import { createDemoEntry, openCloudImprovement, wireDemoEntry } from './demo-entry';
import { mountCompliance } from './shell';

const stylesheet = readFileSync(path.resolve('src/style.css'), 'utf8');

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const style = document.createElement('style');
  style.textContent = stylesheet;
  document.head.append(style);
}

async function flush(): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await Promise.resolve();
  }
}

describe('explainer demo button', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it('is a real button with a 44px target, no text selection, and a visible focus ring', () => {
    mountApp();
    const button = document.getElementById('load-demo');
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button?.tagName).toBe('BUTTON');
    expect((button as HTMLButtonElement).type).toBe('button');
    expect(button?.textContent).toBe('Try demo statement');
    expect(button?.classList.contains('hero-primary')).toBe(true);
    const pulse = stylesheet.slice(
      stylesheet.indexOf('.scene-cta .pulse {'),
      stylesheet.indexOf('.scene-cta .pulse:focus-visible'),
    );
    expect(pulse).toMatch(/user-select:\s*none/);
    expect(pulse).toMatch(/min-height:\s*44px/);
    expect(pulse).toMatch(/min-width:\s*44px/);
    const focus = stylesheet.slice(stylesheet.indexOf('.scene-cta .pulse:focus-visible'));
    expect(focus).toMatch(/outline:\s*3px solid var\(--focus\)/);
    const computed = getComputedStyle(button as HTMLElement);
    expect(computed.userSelect).toBe('none');
    expect(computed.minHeight).toBe('52px');
  });

  it('opens an unchecked terms dialog, then starts the demo only after Agree & try demo', async () => {
    mountApp();
    const started: string[] = [];
    const handle = mountCompliance({
      useCloud: () => false,
      onCleared() {
        // This test does not render a dashboard.
      },
    });
    const entry = createDemoEntry({
      termsAccepted: () => localStorage.getItem(FIRST_RUN_STORAGE_KEY) !== null,
      startDemo() {
        started.push('demo');
      },
      askTerms: () => askDemoTerms(),
      acceptTerms() {
        handle.acceptFirstRun();
      },
    });
    wireDemoEntry(document, entry);

    (document.getElementById('empty-demo') as HTMLButtonElement).click();
    await flush();
    const dialog = document.querySelector('[role="dialog"]');
    const checkbox = document.getElementById('demo-terms-check');
    const agree = document.getElementById('demo-terms-agree');
    expect(dialog?.textContent).toContain('analyzes statements on your device');
    expect(dialog?.textContent).toContain('not financial advice');
    expect(dialog?.textContent).toContain(FIRST_RUN_EN.slice(0, 20));
    expect(dialog?.textContent).toContain(DEMO_TERMS_CHECK_EN);
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(checkbox?.hasAttribute('checked')).toBe(false);
    expect(agree).toBeInstanceOf(HTMLButtonElement);
    expect((agree as HTMLButtonElement).disabled).toBe(true);
    expect(agree?.textContent).toBe(DEMO_TERMS_AGREE_EN);
    expect(started).toEqual([]);
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();

    (agree as HTMLButtonElement).click();
    await flush();
    expect(started).toEqual([]);
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();
    expect(handle.textConsentGranted()).toBe(false);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();

    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    }
    expect((agree as HTMLButtonElement).disabled).toBe(false);
    (agree as HTMLButtonElement).click();
    await flush();
    expect(started).toEqual(['demo']);
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toContain('2026-11-15');
    expect(handle.textConsentGranted()).toBe(false);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not record terms or start the demo when the dialog is dismissed', async () => {
    mountApp();
    const started: string[] = [];
    const entry = createDemoEntry({
      termsAccepted: () => false,
      startDemo() {
        started.push('demo');
      },
      askTerms: () => askDemoTerms(),
      acceptTerms() {
        started.push('accept');
      },
    });
    wireDemoEntry(document, entry);
    (document.getElementById('load-demo') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(started).toEqual([]);
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();
  });

  it('starts the demo immediately when terms were already accepted, including from the header button', () => {
    mountApp();
    localStorage.setItem(FIRST_RUN_STORAGE_KEY, JSON.stringify({
      continuedAt: '2026-11-19T00:00:00.000Z',
      textVersion: '2026-11-15',
    }));
    const started: string[] = [];
    const entry = createDemoEntry({
      termsAccepted: () => localStorage.getItem(FIRST_RUN_STORAGE_KEY) !== null,
      startDemo() {
        started.push('demo');
      },
      askTerms: () => Promise.resolve(false),
      acceptTerms() {
        started.push('accept');
      },
    });
    wireDemoEntry(document, entry);
    (document.getElementById('empty-demo') as HTMLButtonElement).click();
    (document.getElementById('load-demo') as HTMLButtonElement).click();
    expect(started).toEqual(['demo', 'demo']);
  });

  it('asks for terms again after Clear my data removes the acknowledgement', async () => {
    mountApp();
    localStorage.setItem(FIRST_RUN_STORAGE_KEY, JSON.stringify({
      continuedAt: '2026-11-19T00:00:00.000Z',
      textVersion: '2026-11-15',
    }));
    clearStorage(localStorage);
    const entry = createDemoEntry({
      termsAccepted: () => localStorage.getItem(FIRST_RUN_STORAGE_KEY) !== null,
      startDemo() {
        throw new Error('demo should wait');
      },
      askTerms: () => askDemoTerms(),
      acceptTerms() {
        throw new Error('not accepted');
      },
    });
    wireDemoEntry(document, entry);
    (document.getElementById('load-demo') as HTMLButtonElement).click();
    await flush();
    const checkbox = document.getElementById('demo-terms-check');
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
  });

  it('opens the existing cloud dialog from Improve with Cloud AI without a checked box', async () => {
    let ran = false;
    const pending = openCloudImprovement({
      lines: ['01/10/26 Netflix $15.49'],
      ask: (preview) => askTextConsent({ preview }),
      run: async () => {
        ran = true;
      },
    });
    await flush();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(CLOUD_TEXT_BODY_EN);
    const boxes = [...(dialog?.querySelectorAll('input[type="checkbox"]') ?? [])];
    expect(boxes.every((box) => (box as HTMLInputElement).checked === false)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pending;
    expect(ran).toBe(false);
  });
});
