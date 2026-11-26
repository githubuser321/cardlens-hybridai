import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { analyzeTransactions } from '../analyze/categorize';
import { createInsights } from '../insights/create-insights';
import { compareMonths } from '../compare/months';
import { extractHeaderHints, redactText } from '../redact/redact';
import { textItemsToLines, type PdfTextItem } from '../pdf/text-items-to-lines';
import { parseStatementLines } from './statement';

const legacyRoot = new URL('../../node_modules/pdfjs-dist/legacy/build/', import.meta.url);
const demoPdf = new URL('../../public/demo/demo-statement.pdf', import.meta.url);
const demoScan = new URL('../../public/demo/demo-statement-scan.jpg', import.meta.url);

GlobalWorkerOptions.workerSrc = pathToFileURL(fileUrl(new URL('pdf.worker.min.mjs', legacyRoot))).href;

describe('demo statement fixtures', () => {
  it('parses the fictional October USD demo and redacts the sample header', async () => {
    const lines = await pdfLines(demoPdf);
    const text = lines.join('\n');
    expect(text).toContain('Sample Bank');
    expect(text).toContain('Visa •••• 4242');
    expect(text).toContain('Fictional statement for demonstration.');
    expect(text).toContain('Cafe de Flore, Paris EUR 18.40 = $19.98');
    expect(text).not.toMatch(/[\u0590-\u05FF]/);

    const parsed = parseStatementLines(lines);
    expect(parsed.every((row) => row.currency === 'USD')).toBe(true);
    expect(parsed.every((row) => row.date.startsWith('2026-10'))).toBe(true);
    const total = Number(parsed.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
    expect(total).toBe(550.93);
    expect(parsed.find((row) => row.merchant.includes('Flore'))?.amount).toBe(19.98);
    expect(parsed.find((row) => row.amount < 0)?.merchant).toMatch(/Amazon/);

    const analysis = await analyzeTransactions(parsed, { lines, model: null });
    expect(analysis.subscriptions).toEqual([]);
    const insights = await createInsights({
      lines,
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      transactions: analysis.transactions,
      anomalies: analysis.anomalies,
      model: null,
    });
    expect(insights.insights[0]).toBe(
      '4 recurring charges (Netflix, Spotify, iCloud+, ChatGPT Plus), about $50.47 per month.',
    );
    expect(analysis.sent).toBe(false);
    expect(analysis.transactions.every((row) => row.inferenceSource === 'RULES')).toBe(true);
    expect(analysis.anomalies.some((row) => row.kind === 'fee')).toBe(true);
    expect(compareMonths(analysis.transactions, analysis.subscriptions)?.currentMonth ?? '2026-10').toBe('2026-10');

    const redacted = redactText(text, extractHeaderHints(lines));
    expect(redacted.text).not.toContain('Sample Cardholder');
    expect(redacted.text).not.toContain('4242-4242-4242-4242');
    expect(redacted.text).not.toContain('sample.cardholder@example.com');
    expect(redacted.text).toContain('Netflix');
    expect(redacted.text).toContain('[REDACTED_NAME]');
    expect(redacted.text).toContain('[REDACTED_PAN]');
    expect(redacted.text).toContain('[REDACTED_EMAIL]');
    expect(JSON.stringify(analysis.payload)).not.toContain('Sample Cardholder');
  });

  it('ships a noisy JPEG rendering of the demo page', () => {
    const scan = readFileSync(demoScan);
    expect(scan[0]).toBe(0xff);
    expect(scan[1]).toBe(0xd8);
    expect(scan.byteLength).toBeGreaterThan(50_000);
  });
});

async function pdfLines(url: URL): Promise<string[]> {
  const data = new Uint8Array(readFileSync(url));
  const task = getDocument({ data });
  try {
    const pdf = await task.promise;
    const pages: string[][] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item)) {
          continue;
        }
        items.push({
          str: item.str,
          hasEOL: item.hasEOL,
          transform: item.transform.flatMap((value) => (typeof value === 'number' ? [value] : [])),
        });
      }
      pages.push(textItemsToLines(items));
    }
    return pages.flat();
  } finally {
    await task.destroy();
  }
}

function fileUrl(url: URL): string {
  return url.pathname;
}
