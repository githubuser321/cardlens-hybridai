// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CLOUD_TEXT_BODY_EN, CONSENT_TEXT_VERSION } from '../compliance/copy';
import { explainSorting } from './source-explain';
import { closeSortPopover, createSourceButton, setSortContext } from './source-badge';

const base = {
  gate: 'remote-on' as const,
  preferenceNever: false,
  sessionOff: false,
  modelUnsupported: false,
  declined: false,
};

describe('source badges and reasons', () => {
  it('uses the plain labels and the first matching reason', () => {
    expect(explainSorting('RULES', { ...base, modelUnsupported: true }).body).toMatch(/doesn't have built-in AI/);
    expect(explainSorting('RULES', { ...base, modelUnsupported: true, preferenceNever: true }).action).toBe('browsers');
    expect(explainSorting('RULES', { ...base, preferenceNever: true }).action).toBe('settings');
    expect(explainSorting('RULES', { ...base, sessionOff: true }).body).toMatch(/keep analysis on this device/);
    expect(explainSorting('RULES', { ...base, gate: 'fetch-failed-restricted' }).body).toMatch(/region/);
    expect(explainSorting('RULES', { ...base, gate: 'offline' }).body).toMatch(/offline/);
    expect(explainSorting('RULES', { ...base, gate: 'app-check' }).action).toBe('retry');
    expect(explainSorting('ON_DEVICE', base).body).toMatch(/Nothing left your device/);
    expect(explainSorting('IN_CLOUD', base).actionLabel).toBe('See what was sent');
    expect(CONSENT_TEXT_VERSION).toBe('2026-11-15-free-b');
  });

  it('opens the popover from click and Enter, and Escape returns focus', () => {
    setSortContext({ ...base, modelUnsupported: true });
    const badge = createSourceButton('RULES');
    document.body.append(badge);
    expect(badge.textContent).toMatch(/Basic sorting \(no AI\)/);
    badge.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const dialog = document.getElementById('sort-popover');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.textContent).toMatch(/Why basic sorting/);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('sort-popover')).toBeNull();
    expect(document.activeElement).toBe(badge);
    badge.click();
    expect(document.getElementById('sort-popover')?.textContent).toMatch(/Why basic sorting/);
    document.getElementById('sort-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('sort-popover')).toBeNull();
    expect(document.activeElement).toBe(badge);
    closeSortPopover();
  });

  it('keeps the cloud consent wording available unchanged', () => {
    expect(CLOUD_TEXT_BODY_EN).toMatch(/Gemini API/);
    expect(CLOUD_TEXT_BODY_EN).toMatch(/human reviewers may read it/);
  });
});
