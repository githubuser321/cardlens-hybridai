import { describe, expect, it } from 'vitest';
import { ON_DEVICE_REQUIREMENTS, onboardingCopy } from './copy';

describe('onboardingCopy', () => {
  it('keeps an unsupported browser to one line, with no download or dismiss button', () => {
    const nag = onboardingCopy({ availability: 'not-supported', nag: true, progress: null, error: null });
    expect(nag.badge).toBe('Basic sorting');
    expect(nag.requirements).toBeNull();
    expect(nag.downloadEnabled).toBe(false);
    expect(nag.showDownload).toBe(false);
    expect(nag.showDismiss).toBe(false);
    expect(nag.status).toMatch(/basic sorting/i);
    expect(nag.status).not.toMatch(/Download unavailable/);

    const quiet = onboardingCopy({ availability: 'not-supported', nag: false, progress: null, error: null });
    expect(quiet.requirements).toBeNull();
    expect(quiet.showDismiss).toBe(false);
    expect(quiet.showDownload).toBe(false);
    expect(ON_DEVICE_REQUIREMENTS).toMatch(/Chrome 148/);
  });

  it('shows a progress percent while downloading and keeps rules available', () => {
    const copy = onboardingCopy({ availability: 'downloading', nag: true, progress: 0.426, error: null });
    expect(copy.badge).toBe('Downloading');
    expect(copy.progressPercent).toBe(43);
    expect(copy.showProgress).toBe(true);
    expect(copy.downloadEnabled).toBe(false);
    expect(copy.status).toContain('43%');
    expect(copy.status).toMatch(/keyword rules/i);
  });

  it('offers a click-to-download action and a quiet state after dismiss', () => {
    const nag = onboardingCopy({ availability: 'downloadable', nag: true, progress: null, error: null });
    expect(nag.downloadEnabled).toBe(true);
    expect(nag.downloadLabel).toMatch(/download/i);
    expect(nag.showDismiss).toBe(true);
    const quiet = onboardingCopy({ availability: 'downloadable', nag: false, progress: null, error: null });
    expect(quiet.showDismiss).toBe(false);
    expect(quiet.status).toMatch(/not downloaded/i);
  });

  it('does not nag when the model is ready, and surfaces a download error', () => {
    const ready = onboardingCopy({ availability: 'available', nag: true, progress: null, error: null });
    expect(ready.showDismiss).toBe(false);
    expect(ready.downloadEnabled).toBe(false);
    expect(ready.status).toMatch(/keyword rules/i);
    const failed = onboardingCopy({
      availability: 'downloadable',
      nag: true,
      progress: 0.2,
      error: 'Download failed',
    });
    expect(failed.status).toBe('Download failed');
    expect(failed.showProgress).toBe(false);
    expect(failed.downloadEnabled).toBe(true);
  });
});
