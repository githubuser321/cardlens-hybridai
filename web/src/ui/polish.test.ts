// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIRST_RUN_CONTINUE_EN } from '../compliance/copy';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const style = document.createElement('style');
  style.textContent = readFileSync(path.resolve('src/style.css'), 'utf8');
  document.head.append(style);
}

describe('visual polish', () => {
  it('hides the device-choice banner until results exist', () => {
    mountApp();
    const note = document.getElementById('device-choice');
    expect(note).toBeInstanceOf(HTMLElement);
    if (!(note instanceof HTMLElement)) {
      return;
    }
    note.hidden = false;
    document.body.dataset.analysis = 'empty';
    expect(getComputedStyle(note).display).toBe('none');
    document.body.dataset.analysis = 'ready';
    note.hidden = false;
    expect(getComputedStyle(note).display).not.toBe('none');
    note.hidden = true;
    expect(getComputedStyle(note).display).toBe('none');
  });

  it('keeps legal links on Home and in Settings, with the reCAPTCHA notice on both', () => {
    mountApp();
    const home = document.getElementById('view-home');
    const settings = document.getElementById('about-legal');
    expect(home?.querySelector('#home-legal')?.textContent).toMatch(/Privacy/);
    expect(home?.querySelector('#home-legal a[href="/terms"]')).not.toBeNull();
    expect(home?.querySelector('#home-legal a[href="/accessibility"]')).not.toBeNull();
    expect(home?.querySelector('#recaptcha-home-line')?.textContent).toMatch(/reCAPTCHA/);
    expect(settings?.querySelector('#footer-studio')?.textContent).toBe('Dash Buddies Games');
    expect(settings?.querySelector('#link-privacy')?.getAttribute('href')).toBe('/privacy');
    expect(settings?.querySelector('#link-terms')?.getAttribute('href')).toBe('/terms');
    expect(settings?.querySelector('#link-accessibility')?.getAttribute('href')).toBe('/accessibility');
    expect(settings?.querySelector('#link-contact')?.getAttribute('href')).toContain('mailto:');
    expect(settings?.querySelector('#recaptcha-footer-line')?.textContent).toMatch(/reCAPTCHA/);
    expect(document.getElementById('view-results')?.querySelector('footer')).toBeNull();
    expect(document.getElementById('recaptcha-results-line')?.textContent).toMatch(/reCAPTCHA/);
  });

  it('insets the tab bar and pads the terms gate without changing its copy', () => {
    const css = readFileSync(path.resolve('src/style.css'), 'utf8');
    const mobile = css.slice(css.lastIndexOf('@media (max-width: 768px)'));
    expect(mobile).toMatch(/\.app-nav\s*\{[^}]*padding:\s*8px/);
    expect(mobile).toMatch(/\.app-nav a\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.app-nav a\[aria-selected='true'\]\s*\{[^}]*linear-gradient\(135deg,\s*#0f766e,\s*#5b21b6\)/);
    expect(css).toMatch(/\.app-nav a:focus-visible,\s*\.app-nav a\[aria-selected='true'\]:focus-visible\s*\{[^}]*outline:\s*2px solid #0f766e;\s*outline-offset:\s*3px/);
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.app-nav a\s*\{[^}]*transition:\s*none/);
    expect(css).toMatch(/#first-run\s*\{[^}]*padding:\s*1\.15rem 1\.25rem 1\.25rem/);
    mountApp();
    expect(document.getElementById('first-run-heading')?.textContent).toBe('Before you start');
    expect(document.getElementById('first-run-continue')?.textContent).toBe('Continue');
  });

  it('keeps the terms gate heading and Continue label', () => {
    mountApp();
    expect(document.getElementById('first-run-heading')?.textContent).toBe('Before you start');
    expect(document.getElementById('first-run-continue')?.textContent).toBe(FIRST_RUN_CONTINUE_EN);
    expect(document.getElementById('empty-heading')?.textContent).toBe('No results yet');
    expect(document.getElementById('empty-demo')).toBeInstanceOf(HTMLButtonElement);
    expect(document.getElementById('load-demo')).toBeInstanceOf(HTMLButtonElement);
  });
});
