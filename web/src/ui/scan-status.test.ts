// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SCAN_CLOUD_FAILED_MESSAGE, presentScanFailure, scanBlockedMessage } from '../scan/policy';
import { CloudNotSentError, IMAGE_NOT_SENT_MESSAGE } from '../compliance/errors';
import { afterNextPaint, markReadingScan } from './scan-status';

describe('scan failure copy', () => {
  it('hides a raw 401 behind details and keeps the Settings path', () => {
    const failed = presentScanFailure(new Error('401 App Check token is invalid (AI/fetch-error) https://securetoken.example/token'));
    expect(failed.message).toBe(SCAN_CLOUD_FAILED_MESSAGE);
    expect(failed.message).not.toMatch(/401|https?:\/\//);
    expect(failed.detail).toMatch(/401/);
    expect(failed.detail).toMatch(/https:\/\/securetoken\.example/);

    const blocked = scanBlockedMessage({ configured: true, online: true, allowCloud: false });
    const shown = presentScanFailure(new CloudNotSentError(blocked));
    expect(shown.message).toBe(blocked);
    expect(shown.message).toMatch(/Always ask/);
    expect(shown.detail).toBeNull();

    const declined = presentScanFailure(new CloudNotSentError(IMAGE_NOT_SENT_MESSAGE));
    expect(declined.message).toBe('Kept on this device. The image was not sent.');
    expect(declined.detail).toBeNull();
  });

  it('paints the reading spinner before the next frame', async () => {
    const section = document.createElement('section');
    const status = document.createElement('p');
    status.id = 'pdf-status';
    section.append(status);
    let frames = 0;
    const original = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => {
      frames += 1;
      callback(0);
      return 1;
    };
    try {
      markReadingScan(status, 'page.jpg');
      expect(status.classList.contains('is-reading')).toBe(true);
      expect(status.textContent).toContain('Reading scan page.jpg');
      expect(section.getAttribute('aria-busy')).toBe('true');
      expect(frames).toBe(0);
      await afterNextPaint();
      expect(frames).toBe(1);
    } finally {
      globalThis.requestAnimationFrame = original;
    }
  });
});