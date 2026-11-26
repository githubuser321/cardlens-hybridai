// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CLOUD_IMAGE_CHECK_EN,
  CLOUD_IMAGE_SEND_EN,
  CLOUD_TEXT_BODY_EN,
  CLOUD_TEXT_KEEP_EN,
  CLOUD_TEXT_SEND_EN,
  RECAPTCHA_LINE_EN,
} from '../compliance/copy';
import { askImageConsent, askTextConsent } from './consent-dialog';

describe('consent dialogs', () => {
  it('focuses Keep it on my device, traps focus, and Escape refuses the send', async () => {
    const pending = askTextConsent({
      preview: '1. [REDACTED_NAME]\n2. Harbor Grocery',
    });
    await Promise.resolve();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain(CLOUD_TEXT_BODY_EN);
    expect(dialog?.textContent).toContain(RECAPTCHA_LINE_EN);
    expect(dialog?.textContent).not.toMatch(/policies\.google\.com|Google Privacy Policy|Terms of Service/);
    const keep = [...document.querySelectorAll('button')].find((button) => button.textContent === CLOUD_TEXT_KEEP_EN);
    const send = [...document.querySelectorAll('button')].find((button) => button.textContent === CLOUD_TEXT_SEND_EN);
    expect(document.activeElement).toBe(keep);
    expect(keep?.classList.contains('button-primary')).toBe(true);
    expect(send?.classList.contains('button-quiet')).toBe(true);
    expect(keep?.className).not.toBe(send?.className);
    const previewButton = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-controls') === 'consent-preview');
    expect(previewButton?.classList.contains('button-prominent')).toBe(true);
    previewButton?.click();
    expect(document.getElementById('consent-preview')?.textContent).toContain('[REDACTED_NAME]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(pending).resolves.toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps Send image disabled until the unchecked box is checked', async () => {
    const pending = askImageConsent({
      previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    });
    await Promise.resolve();
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const send = [...document.querySelectorAll('button')].find((button) => button.textContent === CLOUD_IMAGE_SEND_EN);
    expect(checkbox?.checked).toBe(false);
    expect(send?.disabled).toBe(true);
    expect(document.querySelector('label')?.textContent).toContain(CLOUD_IMAGE_CHECK_EN);
    expect(document.activeElement?.textContent).toBe('Cancel');
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    }
    expect(send?.disabled).toBe(false);
    send?.click();
    await expect(pending).resolves.toBe(true);
  });

  it('keeps the dialog in English and left to right', async () => {
    const pending = askTextConsent({ preview: '[REDACTED_PAN]' });
    await Promise.resolve();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('lang')).toBe('en');
    expect(dialog?.getAttribute('dir')).toBe('ltr');
    expect(dialog?.textContent).toContain(CLOUD_TEXT_BODY_EN);
    expect(dialog?.textContent).toContain(CLOUD_TEXT_KEEP_EN);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(pending).resolves.toBe(false);
  });
});
