// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStorage } from '../compliance/clear-data';
import { FIRST_RUN_TEXT_VERSION } from '../compliance/copy';
import { FIRST_RUN_STORAGE_KEY } from '../compliance/storage-inventory';
import { mountCompliance } from './shell';

/**
 * Author `display` rules override the user-agent `[hidden] { display: none }`
 * rule in Chrome. This attacking sheet is what used to leave the notice visible.
 */
const ATTACK_DISPLAY = '#first-run { display: grid !important; } section#first-run { display: flex; }';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const style = document.createElement('style');
  style.textContent = `${readFileSync(path.resolve('src/style.css'), 'utf8')}\n${ATTACK_DISPLAY}`;
  document.head.append(style);
}

function mount(): void {
  mountApp();
  mountCompliance({
    useCloud: () => false,
    onCleared() {
      // The notice test does not render a dashboard.
    },
  });
}

function acceptTerms(): void {
  const box = document.getElementById('first-run-agree');
  if (!(box instanceof HTMLInputElement)) {
    throw new Error('Missing terms checkbox');
  }
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('first-run notice', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it('keeps Continue off until the terms box is checked, then shows Agreed', () => {
    mount();
    const section = document.getElementById('first-run');
    expect(section).not.toBeNull();
    expect(getComputedStyle(section!).display).toBe('grid');
    const button = document.getElementById('first-run-continue');
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('#first-run-agree-text a')?.getAttribute('href')).toBe('/terms');
    (button as HTMLButtonElement).click();
    expect(section?.hidden).toBe(false);
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();

    acceptTerms();
    expect((button as HTMLButtonElement).disabled).toBe(false);
    (button as HTMLButtonElement).click();

    expect(section?.isConnected).toBe(true);
    expect(section?.hidden).toBe(false);
    expect(document.getElementById('first-run-form')?.hidden).toBe(true);
    expect(document.getElementById('first-run-agreed')?.hidden).toBe(false);
    expect(document.getElementById('first-run-agreed')?.textContent).toMatch(/Agreed/);
    expect(document.activeElement?.id).toBe('first-run-agreed');

    const saved = JSON.parse(localStorage.getItem(FIRST_RUN_STORAGE_KEY) ?? 'null') as {
      continuedAt?: string;
      textVersion?: string;
    };
    expect(saved.textVersion).toBe(FIRST_RUN_TEXT_VERSION);
    expect(saved.continuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    mount();
    const again = document.getElementById('first-run');
    expect(again?.hidden).toBe(true);
    expect(getComputedStyle(again!).display).toBe('none');
  });

  it('hides when Continue is activated with Enter or Space after agreeing', () => {
    for (const key of ['Enter', ' ']) {
      localStorage.clear();
      document.head.replaceChildren();
      mount();
      const button = document.getElementById('first-run-continue');
      button?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(document.getElementById('first-run')?.hidden).toBe(false);
      expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();
      acceptTerms();
      button?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      const section = document.getElementById('first-run');
      expect(document.getElementById('first-run-agreed')?.hidden).toBe(false);
      expect(section?.hidden).toBe(false);
      expect(document.activeElement?.id).toBe('first-run-agreed');
    }
  });

  it('shows the notice again after Clear my data removes the seen flag', () => {
    mount();
    acceptTerms();
    (document.getElementById('first-run-continue') as HTMLButtonElement).click();
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toContain(FIRST_RUN_TEXT_VERSION);
    const removed = clearStorage(localStorage);
    expect(removed).toContain(FIRST_RUN_STORAGE_KEY);
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();

    document.head.replaceChildren();
    mount();
    const section = document.getElementById('first-run');
    expect(section?.hidden).toBe(false);
    expect(getComputedStyle(section!).display).not.toBe('none');
  });
});
