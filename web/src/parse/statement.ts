import { textItemsToLines, type PdfTextItem } from '../pdf/text-items-to-lines';
import { normalizeForMatch, normalizeLine } from '../text/normalize';

/**
 * One purchase or refund row from a statement.
 * `amount` follows shared/schema/transaction.schema.json: positive charge, negative credit/refund.
 * `installments` is web-only. It is not part of the shared schema.
 */
export interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  installments: InstallmentPlan | null;
}

export interface InstallmentPlan {
  current: number;
  total: number;
}

const STRONG_TOTAL = new Set([
  'סהכ',
  'total',
  'יתרה',
  'balance',
  'לתשלום',
  'סיכום',
  'subtotal',
  'סך',
]);

const TOTAL_STOP = new Set([
  ...STRONG_TOTAL,
  'הכל',
  'הכול',
  'grand',
  'due',
  'amount',
  'previous',
  'קודמת',
  'סכום',
  'לחיוב',
  'עסקאות',
  'בחודש',
  'the',
  'for',
  'to',
  'pay',
  'חיוב',
]);

const HEADER_WORDS = new Set([
  'תאריך',
  'עסקה',
  'בית',
  'עסק',
  'העסק',
  'שם',
  'סכום',
  'date',
  'merchant',
  'description',
  'amount',
  'details',
  'transaction',
]);

const CURRENCY_WORDS: Record<string, string> = {
  nis: 'ILS',
  ils: 'ILS',
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  'ש"ח': 'ILS',
  שח: 'ILS',
  '₪': 'ILS',
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

interface AmountHit {
  value: number;
  currency: string | null;
  decimal: boolean;
  index: number;
}

/**
 * Parse statement lines into transactions. Pure: no network and no model.
 * Handles Hebrew and English, day-first dates, shekel amounts, refunds, installments, and total rows.
 * Lines that look visually reversed (RTL extraction) are tried forwards and backwards.
 */
export function parseStatementLines(lines: readonly string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  for (const line of lines) {
    const parsed = parseStatementLine(line);
    if (parsed) {
      transactions.push(parsed);
    }
  }
  return transactions;
}

export function parseStatementText(text: string): ParsedTransaction[] {
  return parseStatementLines(text.split(/\r?\n/));
}

export function parseStatementItems(items: readonly PdfTextItem[]): ParsedTransaction[] {
  return parseStatementLines(textItemsToLines(items));
}

export function parseStatementLine(line: string): ParsedTransaction | null {
  const normalized = normalizeLine(line);
  if (!normalized) {
    return null;
  }
  const options = uniqueStrings([
    normalized,
    normalized.split(' ').reverse().join(' '),
    [...normalized].reverse().join(''),
  ]);
  let best: { tx: ParsedTransaction; score: number } | null = null;
  for (const option of options) {
    const tx = tryParseLogicalLine(option);
    if (!tx) {
      continue;
    }
    const score = scoreCandidate(option, tx);
    if (!best || score > best.score) {
      best = { tx, score };
    }
  }
  return best?.tx ?? null;
}

function tryParseLogicalLine(line: string): ParsedTransaction | null {
  const separated = separateTokens(line);
  const dated = pullDate(separated);
  if (!dated) {
    return null;
  }
  const installment = pullInstallments(dated.rest);
  const amounts = pullAmounts(installment.rest);
  const chosen = chooseAmount(amounts.hits);
  if (!chosen || chosen.value === 0 || !Number.isFinite(chosen.value)) {
    return null;
  }
  const merchant = cleanupMerchant(amounts.rest);
  if (!isMerchant(merchant) || isTotalText(merchant) || isHeaderText(merchant)) {
    return null;
  }
  const amount = chosen.value < 0 || !isRefund(separated) ? chosen.value : -chosen.value;
  return {
    date: dated.iso,
    merchant,
    amount,
    currency: chosen.currency,
    installments: installment.installments,
  };
}

function scoreCandidate(line: string, tx: ParsedTransaction): number {
  const tokens = separateTokens(line).split(' ').filter(Boolean);
  let score = 0;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (first && parseDateToken(first)) {
    score += 10;
  }
  if (last && parseAmountToken(last)) {
    score += 5;
  }
  if (/[\p{L}]/u.test(tx.merchant)) {
    score += 3;
  }
  if (tx.merchant.length >= 2) {
    score += 1;
  }
  return score;
}

function separateTokens(line: string): string {
  const dates: string[] = [];
  const held = line.replace(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/g, (match) => {
    const token = `§DATE${dates.length}§`;
    dates.push(match);
    return ` ${token} `;
  });
  const spaced = held
    .replace(/[₪$€£]/g, ' $& ')
    .replace(/(?<![A-Za-z])(NIS|ILS|USD|EUR|GBP)(?![A-Za-z])/gi, ' $1 ')
    .replace(/ש"ח/g, ' ש"ח ')
    .replace(/(?:\((?:[+-])?(?:\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2})\)|[+-]?(?:\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2})[+-]?)/g, ' $& ');
  const restored = spaced.replace(/§DATE(\d+)§/g, (_match, index: string) => dates[Number(index)] ?? '');
  return restored.replace(/\s+/g, ' ').trim();
}

function pullDate(line: string): { iso: string; rest: string } | null {
  const tokens = line.split(' ').filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    const iso = parseDateToken(tokens[index] ?? '');
    if (!iso) {
      continue;
    }
    const rest = tokens.filter((_token, tokenIndex) => tokenIndex !== index).join(' ');
    return { iso, rest };
  }
  return null;
}

function parseDateToken(token: string): string | null {
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(token);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearRaw = Number(match[3]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (year < 1990 || year > 2100) {
    return null;
  }
  return isoDate(day, month, year);
}

function isoDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

function pullInstallments(line: string): {
  installments: InstallmentPlan | null;
  rest: string;
} {
  const patterns = [
    /(?:תשלומים|תשלומי|תשלום)\s+(\d{1,2})\s+מתוך\s+(\d{1,2})/g,
    /(?:תשלומים|תשלומי|תשלום)\s+(\d{1,2})\s*\/\s*(\d{1,2})/g,
    /installments?\s+(\d{1,2})\s*(?:of|\/)\s*(\d{1,2})/gi,
    /(^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?=\s|$)/g,
  ];
  let best: { current: number; total: number; start: number; end: number } | null = null;
  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      const numbers = match.slice(1).filter((group) => group !== undefined && /^\d+$/.test(group));
      if (numbers.length < 2) {
        continue;
      }
      const current = Number(numbers[0]);
      const total = Number(numbers[1]);
      if (!isInstallment(current, total) || match.index === undefined) {
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (!best || start >= best.start) {
        best = { current, total, start, end };
      }
    }
  }
  if (!best) {
    return { installments: null, rest: line };
  }
  const rest = `${line.slice(0, best.start)} ${line.slice(best.end)}`.replace(/\s+/g, ' ').trim();
  return {
    installments: { current: best.current, total: best.total },
    rest,
  };
}

function isInstallment(current: number, total: number): boolean {
  return current >= 1 && total >= 2 && total <= 36 && current <= total;
}

function pullAmounts(line: string): { hits: AmountHit[]; rest: string } {
  const tokens = line.split(' ').filter(Boolean);
  const hits: AmountHit[] = [];
  const consumed = new Set<number>();
  let pending: string | null = null;

  tokens.forEach((token, index) => {
    const word = currencyCode(token);
    const parsed = parseAmountToken(token);
    if (word && !parsed) {
      const previous = hits[hits.length - 1];
      if (previous && previous.index === index - 1 && previous.currency === null) {
        previous.currency = word;
      } else {
        pending = word;
      }
      consumed.add(index);
      return;
    }
    if (!parsed) {
      pending = null;
      return;
    }
    hits.push({
      value: parsed.value,
      currency: parsed.currency ?? pending,
      decimal: parsed.decimal,
      index,
    });
    pending = null;
    consumed.add(index);
  });

  const decimalHits = hits.filter((hit) => hit.decimal);
  if (decimalHits.length > 0) {
    for (const hit of hits) {
      if (!hit.decimal) {
        consumed.delete(hit.index);
      }
    }
  }
  const selected = decimalHits.length > 0 ? decimalHits : hits;
  const rest = tokens.filter((_token, index) => !consumed.has(index)).join(' ');
  return { hits: selected, rest };
}

function chooseAmount(hits: readonly AmountHit[]): { value: number; currency: string } | null {
  if (hits.length === 0) {
    return null;
  }
  const explicitIls = hits.filter((hit) => hit.currency === 'ILS');
  const explicitForeign = hits.filter((hit) => hit.currency && hit.currency !== 'ILS');
  const unlabeled = hits.filter((hit) => !hit.currency);
  if (explicitIls.length > 0 && (explicitForeign.length > 0 || unlabeled.length > 0)) {
    const hit = explicitIls[explicitIls.length - 1];
    return hit ? { value: hit.value, currency: 'ILS' } : null;
  }
  if (explicitForeign.length > 0 && unlabeled.length > 0) {
    const hit = unlabeled[unlabeled.length - 1];
    return hit ? { value: hit.value, currency: 'ILS' } : null;
  }
  const hit = hits[hits.length - 1];
  if (!hit) {
    return null;
  }
  return { value: hit.value, currency: hit.currency ?? 'ILS' };
}

function parseAmountToken(token: string): { value: number; currency: string | null; decimal: boolean } | null {
  let working = token.trim();
  let negative = false;
  if (/^\(.*\)$/.test(working) || /^\[.*\]$/.test(working)) {
    negative = true;
    working = working.slice(1, -1).trim();
  }
  let currency: string | null = null;
  const prefixed = /^(₪|\$|€|£)/.exec(working);
  const suffixed = /(₪|\$|€|£)$/.exec(working);
  if (prefixed?.[1]) {
    currency = CURRENCY_WORDS[prefixed[1]] ?? null;
    working = working.slice(prefixed[1].length).trim();
  } else if (suffixed?.[1]) {
    currency = CURRENCY_WORDS[suffixed[1]] ?? null;
    working = working.slice(0, -suffixed[1].length).trim();
  }
  if (working.startsWith('+')) {
    working = working.slice(1);
  } else if (working.startsWith('-')) {
    negative = true;
    working = working.slice(1);
  }
  if (working.endsWith('-')) {
    negative = true;
    working = working.slice(0, -1);
  }
  working = working.trim();
  const thousands = /^(\d{1,3}(?:,\d{3})+)\.(\d{2})$/.exec(working);
  const decimal = /^(\d+)[.,](\d{2})$/.exec(working);
  const integer = /^(\d{1,7})$/.exec(working);
  let cents: number;
  let isDecimal = false;
  if (thousands?.[1] && thousands[2]) {
    cents = Number(thousands[1].replace(/,/g, '')) * 100 + Number(thousands[2]);
    isDecimal = true;
  } else if (decimal?.[1] && decimal[2] && !decimal[1].includes(',')) {
    cents = Number(decimal[1]) * 100 + Number(decimal[2]);
    isDecimal = true;
  } else if (integer?.[1]) {
    const asNumber = Number(integer[1]);
    if (integer[1].length === 4 && asNumber >= 1990 && asNumber <= 2100 && !currency) {
      return null;
    }
    cents = asNumber * 100;
  } else {
    return null;
  }
  return {
    value: (negative ? -cents : cents) / 100,
    currency,
    decimal: isDecimal,
  };
}

function currencyCode(token: string): string | null {
  return CURRENCY_WORDS[token] ?? CURRENCY_WORDS[token.toLowerCase()] ?? null;
}

function cleanupMerchant(text: string): string {
  return text
    .replace(/ש"ח|שח/g, ' ')
    .replace(/\b(?:NIS|ILS|USD|EUR|GBP)\b/gi, ' ')
    .replace(/[₪$€£]/g, ' ')
    .replace(/(?:^|\s)[+-]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMerchant(merchant: string): boolean {
  return merchant.length >= 2 && /[\p{L}]/u.test(merchant);
}

function isRefund(line: string): boolean {
  return /זיכוי|החזר|refund/i.test(line);
}

function isTotalText(merchant: string): boolean {
  const tokens = normalizeForMatch(merchant).split(' ').filter(Boolean);
  if (tokens.length === 0 || !tokens.some((token) => STRONG_TOTAL.has(token))) {
    return false;
  }
  return tokens.every((token) => TOTAL_STOP.has(token));
}

function isHeaderText(merchant: string): boolean {
  const tokens = normalizeForMatch(merchant).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => HEADER_WORDS.has(token));
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}
