// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from '../compliance/csp';
import { STORAGE_INVENTORY } from '../compliance/storage-inventory';
import { FIRST_RUN_EN } from '../compliance/copy';
import { legalDocument } from './documents';
import { ACCESSIBILITY_EMAIL, CONTROLLER_NAME, PRIVACY_EMAIL } from './placeholders';
import { pageFromPath } from './route';
import { renderLegalDocument } from './render';

const PAGES = ['privacy', 'terms', 'accessibility'] as const;

/** Strings that used to stand in for a legal name, email, or postal address. */
const CONTACT_PLACEHOLDERS = [
  'example.com',
  '[CONTROLLER LEGAL NAME]',
  '[ADDRESS, COUNTRY]',
  '[Legal name]',
  '[Company]',
  '[Your name]',
  '[email]',
  '[address]',
  '[contact]',
  '[EMAIL]',
  '[ADDRESS]',
  '[CONTACT]',
  '[NAME]',
];

function expectNoContactPlaceholders(label: string, text: string): void {
  for (const needle of CONTACT_PLACEHOLDERS) {
    expect(text.includes(needle), `${label} still contains ${needle}`).toBe(false);
  }
  expect(text, label).not.toMatch(/\[[A-Z][^\]]*\]/);
}

describe('legal pages', () => {
  it('routes the three public pages', () => {
    expect(pageFromPath('/privacy')).toBe('privacy');
    expect(pageFromPath('/terms/')).toBe('terms');
    expect(pageFromPath('/accessibility')).toBe('accessibility');
    expect(pageFromPath('/')).toBe('app');
  });

  it('publishes Variant B and the storage inventory, with the draft note', () => {
    const privacy = legalDocument('privacy');
    expect(privacy.disclaimer).toMatch(/not a lawyer/i);
    const rendered = renderLegalDocument(privacy);
    const text = rendered.textContent ?? '';
    expect(text.toLowerCase()).toContain('free tier');
    expect(text).toContain('human reviewers');
    expect(text).toMatch(/human reviewers at Google may read/);
    expect(text).toMatch(/not offered when this browser/);
    expect(text).not.toMatch(/does not use the content we send/);
    expect(text).not.toMatch(/Google \*\*does not use/);
    for (const row of STORAGE_INVENTORY) {
      expect(text).toContain(row.name);
    }
    expect(rendered.querySelector('#security')).not.toBeNull();
    expect(rendered.querySelector('#cookies')).not.toBeNull();
    expect(rendered.innerHTML).not.toContain('<script');

    const accessibility = renderLegalDocument(legalDocument('accessibility')).textContent ?? '';
    expect(accessibility).toMatch(/axe-core 4\.14\.0/);
    expect(accessibility).toMatch(/lang` is `en` and `dir` is `ltr`/);
    expect(renderLegalDocument(legalDocument('terms')).textContent).toMatch(/18/);
    expect(text).not.toMatch(/[\u0590-\u05FF]/);
  });

  it('keeps the footer disclosure and the hosting CSP free of Google policy links', () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(path.join(root, '../../index.html'), 'utf8');
    expect(html).toContain('This site is protected by reCAPTCHA.');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/accessibility"');
    expect(html).toContain(`mailto:${PRIVACY_EMAIL}`);
    expect(html).not.toContain('policies.google.com');
    expect(html).not.toContain('allow-scan-cloud');
    const firebase = readFileSync(path.join(root, '../../firebase.json'), 'utf8');
    const config = JSON.parse(firebase) as { hosting: { headers: { headers: { key: string; value: string }[] }[] } };
    const csp = config.hosting.headers[0]?.headers.find((header) => header.key === 'Content-Security-Policy');
    expect(csp?.value).toBe(CONTENT_SECURITY_POLICY);
    expect(csp?.value).toContain('https://www.recaptcha.net');
  });

  it('ships Dash Buddies Games and the public mailbox, with no contact placeholders', () => {
    expect(CONTROLLER_NAME).toBe('Dash Buddies Games');
    expect(PRIVACY_EMAIL).toBe('dashbuddies.games@gmail.com');
    expect(ACCESSIBILITY_EMAIL).toBe(PRIVACY_EMAIL);

    for (const page of PAGES) {
      const rendered = renderLegalDocument(legalDocument(page));
      const blob = `${rendered.textContent ?? ''}\n${rendered.innerHTML}`;
      expectNoContactPlaceholders(page, blob);
      expect(blob).toContain(CONTROLLER_NAME);
      expect(blob).toContain(`mailto:${PRIVACY_EMAIL}`);
      expect(rendered.innerHTML).not.toContain('[REDACTED_NAME]');
      expect(blob).not.toMatch(/[\u0590-\u05FF]/);
    }

    const root = path.dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(path.join(root, '../../index.html'), 'utf8');
    expect(html).toContain('id="first-run-text"');
    expect(html).toContain('id="link-contact"');
    expectNoContactPlaceholders('index.html', html);
    expect(html).toContain(`mailto:${PRIVACY_EMAIL}`);
    expectNoContactPlaceholders('first-run en', FIRST_RUN_EN);
    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="ltr"');
    expect(html).not.toMatch(/[\u0590-\u05FF]/);
  });
});
