import type { ParsedTransaction } from '../parse/statement';
import { parseStatementLines } from '../parse/statement';
import { parsedToSchemaTransaction } from '../parse/schema-transaction';
import { isValidSchemaTransaction } from '../schema/validate-transaction';
import { extractJson, isRecord } from '../text/json';

export function buildScanPrompt(): string {
  return [
    'Read this credit-card statement image.',
    'Return JSON {"lines":["DD/MM/YY MERCHANT 12.34"]} with one transaction per line.',
    'Copy merchant names as printed. Use a minus sign for refunds.',
    'Do not include card numbers, IDs, phone numbers, emails, or the cardholder address.',
    'If the page has no transactions, return {"lines":[]}.',
  ].join('\n');
}

export function parseScanLinesResponse(text: string): string[] {
  const parsed = extractJson(text);
  if (!isRecord(parsed) || !Array.isArray(parsed.lines)) {
    throw new Error('Model response was not statement-line JSON');
  }
  return parsed.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
}

/** Parser output that also satisfies the shared transaction schema. */
export function transactionsFromScanLines(lines: readonly string[]): {
  transactions: ParsedTransaction[];
  skipped: number;
} {
  const parsed = parseStatementLines(lines);
  const transactions = parsed.filter((row) => isValidSchemaTransaction(parsedToSchemaTransaction(row)));
  return { transactions, skipped: parsed.length - transactions.length };
}
