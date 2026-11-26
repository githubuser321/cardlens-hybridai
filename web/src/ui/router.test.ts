// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAppView, bindAppNav, focusUploadZone, viewFromHash } from './router';

describe('hash routes', () => {
  it('maps hashes to home, results, and settings', () => {
    expect(viewFromHash('')).toBe('home');
    expect(viewFromHash('#home')).toBe('home');
    expect(viewFromHash('#results')).toBe('results');
    expect(viewFromHash('#settings')).toBe('settings');
    expect(viewFromHash('#nope')).toBe('home');
  });

  it('shows only the selected view', () => {
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';
    applyAppView('settings', document);
    expect(document.getElementById('view-home')?.hidden).toBe(true);
    expect(document.getElementById('view-results')?.hidden).toBe(true);
    expect(document.getElementById('view-settings')?.hidden).toBe(false);
    expect(document.getElementById('nav-settings')?.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('nav-home')?.getAttribute('aria-selected')).toBe('false');
    const home = document.getElementById('view-home');
    expect(home?.contains(document.querySelector('h1'))).toBe(true);
    expect(home?.contains(document.getElementById('load-demo'))).toBe(true);
    expect(home?.hidden).toBe(true);
    expect(document.getElementById('view-results')?.hidden).toBe(true);
    applyAppView('results', document);
    expect(document.getElementById('view-home')?.hidden).toBe(true);
    expect(document.getElementById('view-results')?.hidden).toBe(false);
    expect(document.getElementById('view-settings')?.hidden).toBe(true);
  });

  it('keeps arrow-key focus on the newly selected tab', async () => {
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';
    window.location.hash = '#results';
    const settings = document.getElementById('settings');
    if (settings) {
      settings.tabIndex = -1;
    }
    const stealFocus = (): void => {
      settings?.focus();
    };
    window.addEventListener('hashchange', stealFocus);
    bindAppNav(document);
    const results = document.getElementById('nav-results');
    expect(results).toBeInstanceOf(HTMLElement);
    results?.focus();
    results?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(window.location.hash).toBe('#settings');
    expect(document.getElementById('view-settings')?.hidden).toBe(false);
    expect(document.activeElement?.id).toBe('nav-settings');
    expect(document.getElementById('nav-settings')?.getAttribute('aria-selected')).toBe('true');

    document.getElementById('nav-settings')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(window.location.hash).toBe('#results');
    expect(document.activeElement?.id).toBe('nav-results');
    window.removeEventListener('hashchange', stealFocus);
  });

  it('refocuses the tab without scrolling the page', () => {
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';
    window.location.hash = '#results';
    const scrolls: number[] = [];
    const originalScroll = window.scrollTo.bind(window);
    window.scrollTo = ((x?: number | ScrollToOptions, y?: number) => {
      if (typeof x === 'number') {
        scrolls.push(y ?? 0);
      }
    }) as typeof window.scrollTo;
    const focused: { id: string; preventScroll?: boolean }[] = [];
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(options?: FocusOptions) {
      focused.push({ id: this.id, preventScroll: options?.preventScroll });
      return originalFocus.call(this, options);
    };
    try {
      bindAppNav(document);
      document.getElementById('nav-results')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      const tabFocus = focused.filter((entry) => entry.id === 'nav-settings');
      expect(tabFocus.length).toBeGreaterThan(0);
      expect(tabFocus.every((entry) => entry.preventScroll === true)).toBe(true);
      expect(scrolls).toContain(0);
    } finally {
      window.scrollTo = originalScroll;
      HTMLElement.prototype.focus = originalFocus;
    }
  });

  it('shows Home before scrolling the drop zone into view', () => {
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';
    applyAppView('results', document);
    const zone = document.getElementById('drop-zone');
    expect(zone).toBeInstanceOf(HTMLElement);
    if (!(zone instanceof HTMLElement)) {
      return;
    }
    const scrolled: ScrollIntoViewOptions[] = [];
    zone.scrollIntoView = (options) => {
      scrolled.push(typeof options === 'object' && options ? options : {});
      expect(document.getElementById('view-home')?.hidden).toBe(false);
    };
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    focusUploadZone(zone, document);
    expect(document.getElementById('view-home')?.hidden).toBe(false);
    expect(document.getElementById('view-results')?.hidden).toBe(true);
    expect(scrolled).toEqual([{ block: 'center', behavior: 'smooth' }]);
    expect(document.activeElement).toBe(zone);
  });

  it('scrolls the drop zone instantly when motion is reduced', () => {
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';
    const zone = document.getElementById('drop-zone');
    expect(zone).toBeInstanceOf(HTMLElement);
    if (!(zone instanceof HTMLElement)) {
      return;
    }
    const scrolled: ScrollIntoViewOptions[] = [];
    zone.scrollIntoView = (options) => {
      scrolled.push(typeof options === 'object' && options ? options : {});
    };
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    focusUploadZone(zone, document);
    expect(scrolled).toEqual([{ block: 'center', behavior: 'auto' }]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
