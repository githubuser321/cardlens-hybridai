import { describe, expect, it } from 'vitest';
import { SAMPLE_STATEMENT_LINES } from '../parse/sample-statement';
import {
  extractHeaderHints,
  prepareCloudMerchantPayload,
  redactText,
} from './redact';

const SECRETS = [
  '4111111111111111',
  '4111-1111-1111-1111',
  '123456782',
  '050-1234567',
  'dana.levi@example.com',
  'IL620108000000012345678',
  '12-345-678901',
  'Dana Levi',
  'Herzl Street',
];

describe('redactText', () => {
  it('masks card numbers, last-4, ids, phones, email, iban, and bank accounts', () => {
    const text = [
      'Card 4111-1111-1111-1111 and 4111111111111111',
      'Invalid 4580123456789012 stays',
      'כרטיס מסתיים ב-4242',
      '****9012',
      'ת.ז. 123456782',
      'id number 12345678-0',
      'reference 123456789 stays',
      '000000000 stays',
      'טלפון: 050-1234567 / +972-50-123-4567 / 03-5551234',
      'dana.levi@example.com',
      'IBAN: IL62 0108 0000 0001 2345 678',
      'חשבון בנק: 12-345-678901',
      'amount 245.90',
    ].join('\n');
    const { text: redacted, report } = redactText(text);
    expect(redacted).not.toContain('4111');
    expect(redacted).toContain('4580123456789012');
    expect(redacted).toContain('123456789');
    expect(redacted).toContain('000000000');
    expect(redacted).toContain('245.90');
    expect(redacted).not.toContain('050-1234567');
    expect(redacted).not.toContain('dana.levi@example.com');
    expect(redacted).not.toContain('IL62');
    expect(redacted).not.toContain('12-345-678901');
    expect(redacted).toContain('[REDACTED_PAN]');
    expect(redacted).toContain('[REDACTED_CARD]');
    expect(redacted).toContain('[REDACTED_ID]');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_IBAN]');
    expect(redacted).toContain('[REDACTED_ACCOUNT]');
    const kinds = report.findings.map((finding) => finding.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      'pan',
      'card-last4',
      'israeli-id',
      'phone',
      'email',
      'iban',
      'bank-account',
    ]));
    expect(report.total).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(report)).not.toContain('4111');
  });

  it('masks a valid unlabeled Israeli id and a labeled id that fails the checksum', () => {
    expect(redactText('id 123456782').text).toContain('[REDACTED_ID]');
    expect(redactText('ת"ז 123456780').text).toContain('[REDACTED_ID]');
    expect(redactText('ת"ז 123456780').text).not.toContain('123456780');
  });

  it('masks header names and addresses, including a name that leaked into a merchant', () => {
    const hints = extractHeaderHints([
      'לכבוד: דנה לוי',
      'Cardholder: Dana Levi',
      'כתובת: רחוב הרצל 10, תל אביב',
      'רחוב דיזנגוף 50',
    ]);
    expect(hints.names).toEqual(['דנה לוי', 'Dana Levi']);
    expect(hints.addresses).toEqual(['רחוב הרצל 10, תל אביב']);
    const { text, report } = redactText('העברה דנה לוי paid Dana Levi at רחוב דיזנגוף 50', hints);
    expect(text).toContain('[REDACTED_NAME]');
    expect(text).toContain('[REDACTED_ADDRESS]');
    expect(text).not.toContain('דנה לוי');
    expect(text).not.toContain('Dana Levi');
    expect(text).not.toContain('דיזנגוף');
    expect(report.findings.some((finding) => finding.kind === 'name' && finding.count >= 2)).toBe(true);
  });

  it('does not treat a fee merchant as a card number', () => {
    expect(redactText('עמלת כרטיס').text).toBe('עמלת כרטיס');
  });

  it('masks spaced card numbers and masked partial cards, and shows placeholders', () => {
    const { text } = redactText([
      'PAN 4111 1111 1111 1111',
      'PAN 4111  1111  1111  1111',
      'mask **** **** **** 4242',
      'partial 4111 **** **** 1111',
      'name stays until a header says so',
    ].join('\n'));
    expect(text).not.toContain('4111');
    expect(text).not.toContain('4242');
    expect(text).not.toContain('1111');
    expect(text).toContain('[REDACTED_PAN]');
    expect(text).toContain('[REDACTED_CARD]');
    expect(text).toContain('name stays until a header says so');
  });
});

describe('prepareCloudMerchantPayload', () => {
  it('returns the redacted merchant payload and a report of header secrets', () => {
    const prepared = prepareCloudMerchantPayload(SAMPLE_STATEMENT_LINES, [
      'Harbor Grocery',
      'Transfer Dana Levi',
      'Card Fee',
    ]);
    expect(prepared.payload.merchants).toEqual([
      'Harbor Grocery',
      'Transfer [REDACTED_NAME]',
      'Card Fee',
    ]);
    const dumped = JSON.stringify(prepared);
    for (const secret of SECRETS) {
      expect(dumped).not.toContain(secret);
    }
    expect(prepared.report.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
      'pan',
      'card-last4',
      'israeli-id',
      'phone',
      'email',
      'iban',
      'bank-account',
      'name',
      'address',
    ]));
    expect(prepared.report.findings.find((finding) => finding.kind === 'name')?.count).toBe(2);
  });
});
