// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_STATEMENT_PDF, isDemoStatementFile, setDemoStatementLink } from './demo-statement-link';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

describe('view demo statement', () => {
  it('stays hidden until the demo PDF is chosen, then opens that asset in a new tab', () => {
    mountApp();
    const holder = document.getElementById('demo-statement-view');
    const link = document.getElementById('view-demo-statement');
    expect(holder?.hidden).toBe(true);
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link?.textContent).toMatch(/View demo statement/);
    expect(link?.textContent).toMatch(/opens in a new tab/);
    expect(link?.textContent).not.toMatch(/click here/i);
    expect(isDemoStatementFile('demo-statement.pdf')).toBe(true);
    expect(isDemoStatementFile('demo-statement-scan.jpg')).toBe(false);

    setDemoStatementLink(document, true);
    expect(holder?.hidden).toBe(false);
    expect(link?.getAttribute('href')).toBe(DEMO_STATEMENT_PDF);
    expect(link?.getAttribute('href')).toBe('/demo/demo-statement.pdf');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect((link as HTMLAnchorElement).tabIndex).not.toBe(-1);

    setDemoStatementLink(document, false);
    expect(holder?.hidden).toBe(true);
  });
});
