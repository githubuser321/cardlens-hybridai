import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HEBREW = /[\u0590-\u05FF]/;
const WEB_ROOT = path.resolve('.');

/**
 * Hebrew characters (U+0590–U+05FF) are not allowed in the user-facing site,
 * the demo/sample sources, or the fixture generator.
 *
 * Exceptions are parser and redaction support for Hebrew statements, plus the
 * unit-test fixtures that exercise that support. They are not product chrome.
 *
 * - src/analyze/rules.ts — keyword rules for Hebrew merchant names.
 * - src/analyze/rules.test.ts — fixtures for those rules.
 * - src/analyze/categorize.test.ts — categorization and redaction of a Hebrew statement.
 * - src/parse/statement.ts — parser for Hebrew totals, headers, currency words, and refunds.
 * - src/parse/statement.test.ts — parser fixtures, including glued Hebrew rows.
 * - src/redact/redact.ts — Hebrew labels for ids, phones, addresses, accounts, and names.
 * - src/redact/redact.test.ts — redaction fixtures, including Israeli ids and Hebrew merchants.
 * - src/text/normalize.ts — Hebrew punctuation (gershayim, geresh, and maqaf) so statements match.
 * - src/scan/scan.test.ts — scan-line fixtures that still use Hebrew merchant names.
 * - src/insights/anomalies.test.ts — anomaly fixtures with Hebrew merchants.
 * - src/insights/create-insights.test.ts — insights fixtures with Hebrew statement text.
 * - src/insights/subscriptions.test.ts — subscription fixtures with Hebrew merchants.
 * - src/compare/months.test.ts — month-comparison fixtures with Hebrew merchants.
 * - src/a11y/screens.test.ts — asserts dir="auto" on a Hebrew merchant name from a statement row.
 */
const EXCEPTIONS = new Set([
  'src/analyze/rules.ts',
  'src/analyze/rules.test.ts',
  'src/analyze/categorize.test.ts',
  'src/parse/statement.ts',
  'src/parse/statement.test.ts',
  'src/redact/redact.ts',
  'src/redact/redact.test.ts',
  'src/text/normalize.ts',
  'src/scan/scan.test.ts',
  'src/insights/anomalies.test.ts',
  'src/insights/create-insights.test.ts',
  'src/insights/subscriptions.test.ts',
  'src/compare/months.test.ts',
  'src/a11y/screens.test.ts',
]);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (/\.(ts|css|html|mjs)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function relative(file: string): string {
  return path.relative(WEB_ROOT, file).split(path.sep).join('/');
}

function hebrewHits(file: string): string[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits: string[] = [];
  lines.forEach((line, index) => {
    if (HEBREW.test(line)) {
      hits.push(`${relative(file)}:${index + 1}`);
    }
  });
  return hits;
}

describe('English-only product text', () => {
  it('rejects Hebrew characters outside parser and redaction fixtures', () => {
    const files = [
      ...walk(path.join(WEB_ROOT, 'src')),
      path.join(WEB_ROOT, 'index.html'),
      path.join(WEB_ROOT, 'scripts', 'make-demo-fixtures.mjs'),
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const name = relative(file);
      if (EXCEPTIONS.has(name)) {
        continue;
      }
      offenders.push(...hebrewHits(file));
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the documented exceptions, and scans the demo and sample sources', () => {
    for (const name of EXCEPTIONS) {
      expect(statSync(path.join(WEB_ROOT, name)).isFile()).toBe(true);
    }
    const scanned = [
      'src/parse/sample-statement.ts',
      'src/parse/sample-statement.test.ts',
      'src/parse/demo-statement.test.ts',
      'scripts/make-demo-fixtures.mjs',
      'index.html',
      'src/compliance/copy.ts',
      'src/ui/shell.ts',
      'src/legal/documents.ts',
    ];
    for (const name of scanned) {
      expect(EXCEPTIONS.has(name)).toBe(false);
      expect(hebrewHits(path.join(WEB_ROOT, name))).toEqual([]);
    }
  });
});
