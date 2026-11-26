// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLEAR_UI_BUDGET_MS, type ClearDataResult } from '../compliance/clear-data';
import { readSessionConsent } from '../compliance/consent-store';
import { CONSENT_STORAGE_KEY, SESSION_CONSENT_KEY } from '../compliance/storage-inventory';
import { mountCompliance } from './shell';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.documentElement.lang = 'en';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

function mount(clearData?: () => Promise<ClearDataResult>) {
  mountApp();
  return mountCompliance({
    useCloud: () => false,
    onCleared() {
      // Settings tests do not render a dashboard.
    },
    clearData,
  });
}

async function settle(): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    await Promise.resolve();
  }
}

describe('session cloud controls', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
  });

  it('hides the unset cloud line instead of the jargon status', () => {
    mount();
    const sessionLine = document.getElementById('session-cloud');
    expect(sessionLine?.hidden).toBe(true);
    expect(sessionLine?.textContent ?? '').not.toMatch(/cloud send/i);
    expect(document.body.textContent).not.toMatch(/This tab has not agreed to a cloud send/);
  });

  it('turns cloud off and back to unset without granting a send', async () => {
    sessionStorage.setItem(SESSION_CONSENT_KEY, JSON.stringify({ text: 'granted' }));
    const handle = mount();
    const off = document.getElementById('session-cloud-off');
    const on = document.getElementById('session-cloud-on');
    expect(off?.hidden).toBe(false);
    expect(on?.hidden).toBe(true);
    expect(handle.textConsentGranted()).toBe(true);

    (off as HTMLButtonElement).click();
    expect(document.getElementById('session-cloud')?.textContent).toMatch(/off for this tab session/i);
    expect(off?.hidden).toBe(true);
    expect(on?.hidden).toBe(false);
    expect(handle.textConsentGranted()).toBe(false);
    expect(readSessionConsent(sessionStorage).text).toBe('off');

    (on as HTMLButtonElement).click();
    const sessionLine = document.getElementById('session-cloud');
    expect(sessionLine?.hidden).toBe(true);
    expect(sessionLine?.textContent ?? '').not.toMatch(/has not agreed|cloud send/i);
    expect(on?.hidden).toBe(true);
    expect(off?.hidden).toBe(true);
    expect(readSessionConsent(sessionStorage).text).toBe('unset');
    expect(handle.textConsentGranted()).toBe(false);

    let settled = false;
    const pending = handle.requestTextConsent('SPOTIFY 21.90').then((allowed) => {
      settled = true;
      return allowed;
    });
    await settle();
    expect(settled).toBe(false);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(readSessionConsent(sessionStorage).text).toBe('unset');
    expect(handle.textConsentGranted()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(pending).resolves.toBe(false);
    expect(handle.textConsentGranted()).toBe(false);
    expect(readSessionConsent(sessionStorage).text).toBe('off');
    expect(document.getElementById('session-cloud-on')?.hidden).toBe(false);
  });

  it('still refuses cloud after re-enable when the saved preference is never', async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ preference: 'never', records: [] }));
    sessionStorage.setItem(SESSION_CONSENT_KEY, JSON.stringify({ text: 'off' }));
    const handle = mount();
    const on = document.getElementById('session-cloud-on');
    expect(on?.hidden).toBe(false);
    (on as HTMLButtonElement).click();
    expect(readSessionConsent(sessionStorage).text).toBe('unset');
    await expect(handle.requestTextConsent('Harbor Grocery 10.00')).resolves.toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(handle.textConsentGranted()).toBe(false);
  });
});

describe('clear my data', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
  });

  it('leaves Clearing and re-enables the button when clearing never settles', async () => {
    vi.useFakeTimers();
    mount(() => new Promise(() => {}));
    const button = document.getElementById('clear-data');
    expect(button).toBeInstanceOf(HTMLButtonElement);
    (button as HTMLButtonElement).click();
    expect(document.getElementById('clear-status')?.textContent).toBe('Clearing…');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(CLEAR_UI_BUDGET_MS);
    const status = document.getElementById('clear-status')?.textContent ?? '';
    expect(status).not.toBe('Clearing…');
    expect(status).toMatch(/did not finish/i);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('reports a partial clear and re-enables the button when a step fails', async () => {
    mount(async () => ({
      storageKeys: ['cardlens.consent.v1'],
      databases: [],
      caches: [],
      installationDeleted: false,
      installationError: 'deleteInstallations timed out',
      partial: true,
    }));
    const button = document.getElementById('clear-data') as HTMLButtonElement;
    button.click();
    await settle();
    const status = document.getElementById('clear-status')?.textContent ?? '';
    expect(status).toMatch(/Local data cleared/);
    expect(status).toMatch(/Some saved browser data could not be removed/);
    expect(status).not.toBe('Clearing…');
    expect(button.disabled).toBe(false);
  });
});
