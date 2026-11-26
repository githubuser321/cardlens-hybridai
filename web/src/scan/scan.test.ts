import { describe, expect, it } from 'vitest';
import { collectStatementLines, pageNeedsScan } from './collect';
import { bytesToBase64, imageFileToScan, isImageFile } from './image';
import { scanBlockedMessage, scanCallAllowed, scanUsesCloud } from './policy';
import { parseScanLinesResponse, transactionsFromScanLines } from './prompt';

describe('scanned statements', () => {
  it('treats an empty page as a scan and keeps text pages local', async () => {
    expect(pageNeedsScan([])).toBe(true);
    expect(pageNeedsScan(['(no text)'])).toBe(true);
    expect(pageNeedsScan(['01/03/26 שופרסל 245.90'])).toBe(false);

    const seen: number[] = [];
    const collected = await collectStatementLines(
      [['01/03/26 שופרסל 245.90'], []],
      (pageNumber) => {
        seen.push(pageNumber);
        return Promise.resolve(['02/03/26 NETFLIX.COM 54.90']);
      },
    );
    expect(seen).toEqual([2]);
    expect(collected.pages).toEqual([['01/03/26 שופרסל 245.90'], ['02/03/26 NETFLIX.COM 54.90']]);
    expect(collected.warnings).toEqual([]);
  });

  it('keeps the empty page and records a warning when transcription fails', async () => {
    const collected = await collectStatementLines([[]], () => Promise.reject(new Error('needs a model')));
    expect(collected.pages).toEqual([[]]);
    expect(collected.warnings[0]).toMatch(/Page 1: needs a model/);
  });

  it('parses model lines through the statement parser and schema check', () => {
    const lines = parseScanLinesResponse('```json\n{"lines":["01/03/26 שופרסל 245.90","not a row",""]}\n```');
    const result = transactionsFromScanLines(lines);
    expect(result.transactions).toEqual([
      { date: '2026-03-01', merchant: 'שופרסל', amount: 245.9, currency: 'ILS', installments: null },
    ]);
    expect(result.skipped).toBe(0);
    expect(() => parseScanLinesResponse('{"nope":true}')).toThrow(/statement-line/i);
  });

  it('allows cloud fallback only with consent while online', () => {
    expect(scanUsesCloud(true, true)).toBe(true);
    expect(scanUsesCloud(true, false)).toBe(false);
    expect(scanUsesCloud(false, true)).toBe(false);
    expect(scanCallAllowed({ allowCloud: false, online: true, onDeviceAvailable: true })).toBe(true);
    expect(scanCallAllowed({ allowCloud: false, online: true, onDeviceAvailable: false })).toBe(false);
    expect(scanCallAllowed({ allowCloud: true, online: true, onDeviceAvailable: false })).toBe(true);
    expect(scanCallAllowed({ allowCloud: true, online: false, onDeviceAvailable: false })).toBe(false);
    expect(scanBlockedMessage({ configured: false, online: true, allowCloud: false })).toMatch(/nothing was sent/i);
    expect(scanBlockedMessage({ configured: true, online: false, allowCloud: true })).toMatch(/offline/i);
    const declined = scanBlockedMessage({ configured: true, online: true, allowCloud: false });
    expect(declined).toMatch(/not sent to the cloud/i);
    expect(declined).toMatch(/Settings/);
    expect(declined).not.toMatch(/cloud fallback/i);
    expect(scanBlockedMessage({ configured: false, online: true, allowCloud: false })).not.toMatch(/Firebase config/);
    expect(scanBlockedMessage({
      configured: true,
      online: true,
      allowCloud: true,
      cloudDisabled: true,
    })).toMatch(/App Check is not configured/);
    expect(scanBlockedMessage({
      configured: true,
      online: true,
      allowCloud: false,
      regionBlocked: true,
    })).toMatch(/EEA, the UK, and Switzerland/);
  });

  it('reads a synthetic image file as base64', async () => {
    const file = new File([Uint8Array.from([1, 2, 3, 4])], 'scan.png', { type: 'image/png' });
    expect(isImageFile(file)).toBe(true);
    expect(isImageFile(new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' }))).toBe(false);
    const image = await imageFileToScan(file);
    expect(image.mimeType).toBe('image/png');
    expect(image.byteLength).toBe(4);
    expect(image.base64).toBe(bytesToBase64(Uint8Array.from([1, 2, 3, 4])));
    await expect(imageFileToScan(new File([], 'empty.png', { type: 'image/png' }))).rejects.toThrow(/empty/i);
  });
});
