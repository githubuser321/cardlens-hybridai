import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

describe('production bundle', () => {
  it('ships no analytics SDK and no App Check debug-token wiring', async () => {
    const packageJson = JSON.parse(await readFile(path.join(webRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(packageJson.dependencies).sort()).toEqual(['firebase', 'pdfjs-dist']);
    const sources = await walk(path.join(webRoot, 'src'), (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
    const sourceText = (await Promise.all(sources.map((file) => readFile(file, 'utf8')))).join('\n');
    expect(sourceText).not.toMatch(/firebase\/analytics|firebase\/performance|firebase\/crashlytics|gtag\(/);
    const withoutCloudDiagnostic = sourceText.replace(/console\.warn\(`CardLens cloud send:/g, '');
    expect(withoutCloudDiagnostic).not.toMatch(/console\.(log|debug|info|warn|error|trace)\(/);

    const outDir = await mkdtemp(path.join(tmpdir(), 'cardlens-bundle-'));
    try {
      await build({
        root: webRoot,
        configFile: path.join(webRoot, 'vite.config.ts'),
        logLevel: 'error',
        build: { outDir, emptyOutDir: true },
      });
      const built = await walk(outDir, (file) => (
        file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.html') || file.endsWith('.css')
      ));
      const bundle = (await Promise.all(built.map((file) => readFile(file, 'utf8')))).join('\n');
      // `@firebase/app` lists sibling package names. Those strings are not the analytics SDK.
      expect(bundle).not.toMatch(/(?<!@)firebase\/analytics|(?<!@)firebase\/performance|(?<!@)firebase\/crashlytics/);
      expect(bundle).not.toMatch(/getAnalytics\s*\(|getPerformance\s*\(|\bgtag\s*\(|googletagmanager/);
      expect(bundle).not.toContain('VITE_APPCHECK_DEBUG_TOKEN');
      expect(bundle).not.toContain('applyAppCheckDebugToken');
      const html = (await Promise.all(built.filter((file) => file.endsWith('.html')).map((file) => readFile(file, 'utf8')))).join('\n');
      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain('https://www.recaptcha.net');
      expect(html).toContain('mailto:dashbuddies.games@gmail.com');
      expect(html).not.toContain('example.com');
      expect(html).not.toMatch(/\[[A-Z][^\]]*\]/);
      const code = (await Promise.all(
        built
          .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
          .map((file) => readFile(file, 'utf8')),
      )).join('\n');
      // Two example.com strings are not contacts: the fictional sample statement,
      // and pdf.js using http://example.com as a base when it resolves a relative URL.
      const shipped = code
        .split('dana.levi@example.com').join('')
        .split('http://example.com').join('');
      expect(shipped).not.toContain('example.com');
      expect(shipped).not.toMatch(/mailto:[^"'`\s]*example\.com/);
      for (const needle of [
        '[CONTROLLER LEGAL NAME]',
        '[ADDRESS, COUNTRY]',
        '[Legal name]',
        '[Company]',
        '[Your name]',
        '[email]',
        '[address]',
        '[contact]',
      ]) {
        expect(code.includes(needle), needle).toBe(false);
      }
      expect(code).toContain('Dash Buddies Games');
      expect(code).toContain('dashbuddies.games@gmail.com');
      expect(code).toContain('[REDACTED_NAME]');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

async function walk(dir: string, accept: (file: string) => boolean): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      files.push(...await walk(full, accept));
    } else if (accept(full)) {
      files.push(full);
    }
  }
  return files;
}
