import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { registerAppShell } from './pwa';

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('offline app shell', () => {
  it('registers the service worker only in production', () => {
    expect(read('./pwa.ts')).toContain('import.meta.env.PROD');
    expect(() => registerAppShell()).not.toThrow();
    const worker = read('../public/sw.js');
    expect(worker).toContain('cardlens-shell-v4');
    expect(worker).not.toContain('cardlens-shell-v3');
    expect(worker).toContain("cache: 'reload'");
    expect(worker).toContain('networkFirstDocument');
    expect(worker).not.toMatch(/AIza|apiKey|firebaseio/i);
    expect(read('../public/manifest.webmanifest')).toContain('"start_url": "/"');
  });
});
