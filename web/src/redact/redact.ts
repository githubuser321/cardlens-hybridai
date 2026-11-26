import { normalizeLine } from '../text/normalize';

export const REDACTION_KINDS = [
  'pan',
  'card-last4',
  'israeli-id',
  'phone',
  'email',
  'iban',
  'bank-account',
  'name',
  'address',
] as const;

export type RedactionKind = (typeof REDACTION_KINDS)[number];

export const PLACEHOLDERS: Record<RedactionKind, string> = {
  pan: '[REDACTED_PAN]',
  'card-last4': '[REDACTED_CARD]',
  'israeli-id': '[REDACTED_ID]',
  phone: '[REDACTED_PHONE]',
  email: '[REDACTED_EMAIL]',
  iban: '[REDACTED_IBAN]',
  'bank-account': '[REDACTED_ACCOUNT]',
  name: '[REDACTED_NAME]',
  address: '[REDACTED_ADDRESS]',
};

export const REDACTION_LABELS: Record<RedactionKind, string> = {
  pan: 'Card number',
  'card-last4': 'Card last 4',
  'israeli-id': 'Israeli ID',
  phone: 'Phone number',
  email: 'Email',
  iban: 'IBAN',
  'bank-account': 'Bank account',
  name: 'Cardholder name',
  address: 'Address',
};

export interface RedactionFinding {
  kind: RedactionKind;
  count: number;
  placeholder: string;
}

export interface RedactionReport {
  findings: RedactionFinding[];
  total: number;
}

export interface RedactionResult {
  text: string;
  report: RedactionReport;
}

export interface HeaderHints {
  names: string[];
  addresses: string[];
}

export interface CloudMerchantPayload {
  /** Merchant strings with PII removed. This is the only transaction text eligible for a cloud call. */
  merchants: string[];
}

export interface PreparedCloudPayload {
  payload: CloudMerchantPayload;
  report: RedactionReport;
}

const EMPTY_HINTS: HeaderHints = { names: [], addresses: [] };

/**
 * Learn cardholder names and addresses from statement header labels.
 * Transaction rows are not treated as a name source unless they use those labels.
 */
export function extractHeaderHints(lines: readonly string[]): HeaderHints {
  const names: string[] = [];
  const addresses: string[] = [];
  for (const raw of lines) {
    const line = normalizeLine(raw);
    const name = nameFromLine(line);
    if (name && !names.includes(name)) {
      names.push(name);
    }
    const address = addressFromLine(line);
    if (address && !addresses.includes(address)) {
      addresses.push(address);
    }
  }
  return { names, addresses };
}

/**
 * Mask PII in free text.
 * The report counts replacements and does not include the original secrets.
 */
export function redactText(text: string, hints: HeaderHints = EMPTY_HINTS): RedactionResult {
  const counts = new Map<RedactionKind, number>();
  let current = lightNormalize(text);

  const apply = (kind: RedactionKind, next: { text: string; count: number }): void => {
    current = next.text;
    if (next.count > 0) {
      counts.set(kind, (counts.get(kind) ?? 0) + next.count);
    }
  };

  apply('email', replacePattern(current, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, PLACEHOLDERS.email));
  apply('iban', replacePattern(current, /IL\d{2}(?:[ -]?\d){19}(?!\d)/g, PLACEHOLDERS.iban));
  apply('bank-account', replacePattern(
    current,
    /(?:חשבון(?:[ \t]+בנק)?|מספר[ \t]+חשבון|bank[ \t]+account)[ \t]*[:#]?[ \t]*\d{2,3}(?:[ \t-]\d{2,9}){1,4}/gi,
    PLACEHOLDERS['bank-account'],
  ));
  apply('bank-account', replacePattern(current, /\b\d{2,3}-\d{3}-\d{5,9}\b/g, PLACEHOLDERS['bank-account']));
  apply('pan', replacePan(current));
  apply('card-last4', replacePattern(
    current,
    /(?:\d{4}[ \t]+)(?:[*xX•●]{2,}[ \t]*)+\d{4}/g,
    PLACEHOLDERS['card-last4'],
  ));
  apply('card-last4', replacePattern(
    current,
    /(?:ending[ \t]+in|ends[ \t]+with|מסתיים[ \t]+ב-?|last[ \t]*4)[ \t]*\d{4}/gi,
    PLACEHOLDERS['card-last4'],
  ));
  apply('card-last4', replacePattern(current, /(?:[*xX•●]{2,}[ \t-]*)+\d{4}/g, PLACEHOLDERS['card-last4']));
  apply('israeli-id', replacePattern(
    current,
    /(?:ת"ז|ת״ז|ת\.ז\.?|תעודת[ \t]+זהות|מספר[ \t]+זהות|id[ \t]+number|id[ \t]+no\.?)[ \t]*[:#]?[ \t]*\d{7,9}(?:[ \t-]\d)?/gi,
    PLACEHOLDERS['israeli-id'],
  ));
  apply('phone', replacePattern(current, phonePattern(), PLACEHOLDERS.phone));
  apply('israeli-id', replaceIsraeliIds(current));
  for (const address of hints.addresses) {
    apply('address', replaceLiteral(current, address, PLACEHOLDERS.address));
  }
  apply('address', replacePattern(
    current,
    /רחוב[ \t]+\p{L}[\p{L}'".\- \t]{0,40}?[ \t]\d{1,4}/gu,
    PLACEHOLDERS.address,
  ));
  apply('address', replacePattern(current, /מיקוד[ \t]*\d{5,7}/g, PLACEHOLDERS.address));
  for (const name of hints.names) {
    apply('name', replaceLiteral(current, name, PLACEHOLDERS.name));
    const swapped = swappedName(name);
    if (swapped && swapped !== name) {
      apply('name', replaceLiteral(current, swapped, PLACEHOLDERS.name));
    }
  }

  return { text: current, report: reportFrom(counts) };
}

/**
 * Build the cloud body and the redaction report.
 * Call this before any Firebase AI Logic request. The payload is merchant strings only.
 */
export function prepareCloudMerchantPayload(
  lines: readonly string[],
  merchants: readonly string[],
): PreparedCloudPayload {
  const hints = extractHeaderHints(lines);
  const document = redactText(lines.join('\n'), hints);
  return {
    payload: {
      merchants: merchants.map((merchant) => redactText(merchant, hints).text),
    },
    report: document.report,
  };
}

function nameFromLine(line: string): string | null {
  const match = /^(?:לכבוד|שם בעל הכרטיס|שם הלקוח|בעל הכרטיס|cardholder|account holder|customer name|dear)\s*[:-]?\s*(.+)$/i.exec(line);
  if (!match?.[1]) {
    return null;
  }
  return cleanName(match[1]);
}

function addressFromLine(line: string): string | null {
  const match = /^(?:כתובת|address|street)\s*[:-]\s*(.+)$/i.exec(line);
  if (!match?.[1]) {
    return null;
  }
  const address = match[1].trim();
  if (address.length < 8 || address.length > 160 || !/[\p{L}]/u.test(address)) {
    return null;
  }
  return address;
}

function cleanName(value: string): string | null {
  const head = value.split(/\d|[,|]/)[0] ?? '';
  const tokens = head
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter((token) => token.length >= 2);
  if (tokens.length < 2 || tokens.length > 4) {
    return null;
  }
  return tokens.join(' ');
}

function swappedName(name: string): string | null {
  const tokens = name.split(' ');
  if (tokens.length !== 2) {
    return null;
  }
  return `${tokens[1]} ${tokens[0]}`;
}

function phonePattern(): RegExp {
  return /(?:\+972[ \t-]?5\d[ \t-]?\d{3}[ \t-]?\d{4}|\+972[ \t-]?[23489][ \t-]?\d{7}|\b05\d(?:[ \t-]?\d{3})?[ \t-]?\d{4}\b|\b0[23489][ \t-]?\d{7}\b|\b07[2-9][ \t-]?\d{7}\b)/g;
}

function replacePan(text: string): { text: string; count: number } {
  return replacePattern(text, /(?<!\d)\d(?:[ \t-]{0,2}\d){12,18}(?!\d)/g, PLACEHOLDERS.pan, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19 && luhn(digits);
  });
}

function replaceIsraeliIds(text: string): { text: string; count: number } {
  return replacePattern(text, /(?<!\d)\d{9}(?!\d)/g, PLACEHOLDERS['israeli-id'], (match) => isIsraeliId(match));
}

function replacePattern(
  text: string,
  pattern: RegExp,
  placeholder: string,
  accept: (match: string) => boolean = () => true,
): { text: string; count: number } {
  let count = 0;
  const next = text.replace(pattern, (match) => {
    if (!accept(match)) {
      return match;
    }
    count += 1;
    return placeholder;
  });
  return { text: next, count };
}

function replaceLiteral(text: string, needle: string, placeholder: string): { text: string; count: number } {
  const trimmed = needle.trim();
  if (trimmed.length < 2) {
    return { text, count: 0 };
  }
  const pattern = new RegExp(escapeRegExp(trimmed), 'giu');
  return replacePattern(text, pattern, placeholder);
}

function reportFrom(counts: Map<RedactionKind, number>): RedactionReport {
  const findings: RedactionFinding[] = [];
  for (const kind of REDACTION_KINDS) {
    const count = counts.get(kind) ?? 0;
    if (count > 0) {
      findings.push({ kind, count, placeholder: PLACEHOLDERS[kind] });
    }
  }
  const total = findings.reduce((sum, finding) => sum + finding.count, 0);
  return { findings, total };
}

function lightNormalize(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/״/g, '"')
    .replace(/׳/g, "'");
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) {
      return false;
    }
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function isIsraeliId(digits: string): boolean {
  if (!/^\d{9}$/.test(digits) || /^(\d)\1{8}$/.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    const char = digits[index];
    if (!char) {
      return false;
    }
    let product = Number(char) * ((index % 2) + 1);
    if (product > 9) {
      product -= 9;
    }
    sum += product;
  }
  return sum % 10 === 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
