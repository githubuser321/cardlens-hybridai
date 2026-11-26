import { describe, expect, it } from 'vitest';
import {
  CLOUD_DISABLED_MESSAGE,
  decideAppCheckInit,
  resolveAnalysisAccess,
} from './app-check-init';

const NOT_CONFIGURED = 'Firebase is not configured.';

describe('decideAppCheckInit', () => {
  it('uses reCAPTCHA Enterprise whenever a site key is present', () => {
    expect(decideAppCheckInit({ siteKey: ' site-key ', isDev: false })).toEqual({
      kind: 'recaptcha-enterprise',
      siteKey: 'site-key',
    });
    expect(decideAppCheckInit({ siteKey: 'site-key', isDev: true }).kind).toBe('recaptcha-enterprise');
  });

  it('keeps the dev debug-token flow when the site key is missing', () => {
    expect(decideAppCheckInit({ siteKey: '   ', isDev: true })).toEqual({ kind: 'debug-token' });
    expect(decideAppCheckInit({ siteKey: undefined, isDev: true })).toEqual({ kind: 'debug-token' });
  });

  it('disables cloud calls when production has neither a site key nor the debug flow', () => {
    const decision = decideAppCheckInit({ siteKey: '', isDev: false });
    expect(decision.kind).toBe('disable-cloud');
    if (decision.kind === 'disable-cloud') {
      expect(decision.message).toBe(CLOUD_DISABLED_MESSAGE);
      expect(decision.message).toMatch(/cloud model calls are off/i);
      expect(decision.message).toMatch(/keyword rules/i);
    }
  });
});

describe('resolveAnalysisAccess', () => {
  it('prefers the missing Firebase banner over App Check', () => {
    const access = resolveAnalysisAccess({
      missingFirebase: true,
      firebaseNotConfiguredMessage: NOT_CONFIGURED,
      decision: { kind: 'recaptcha-enterprise', siteKey: 'site-key' },
    });
    expect(access).toMatchObject({
      useOnDevice: false,
      useCloud: false,
      block: 'firebase-missing',
      banner: { tone: 'warning', message: NOT_CONFIGURED },
    });
  });

  it('keeps on-device models available and blocks cloud when App Check is missing', () => {
    const decision = decideAppCheckInit({ siteKey: null, isDev: false });
    const access = resolveAnalysisAccess({
      missingFirebase: false,
      firebaseNotConfiguredMessage: NOT_CONFIGURED,
      decision,
    });
    expect(access.useOnDevice).toBe(true);
    expect(access.useCloud).toBe(false);
    expect(access.block).toBe('cloud-disabled');
    expect(access.banner.tone).toBe('warning');
    expect(access.banner.message).toMatch(/App Check is not configured/);
  });

  it('allows on-device and cloud for the dev debug token and for reCAPTCHA Enterprise', () => {
    const debug = resolveAnalysisAccess({
      missingFirebase: false,
      firebaseNotConfiguredMessage: NOT_CONFIGURED,
      decision: { kind: 'debug-token' },
    });
    expect(debug.useOnDevice).toBe(true);
    expect(debug.useCloud).toBe(true);
    expect(debug.block).toBeNull();
    expect(debug.banner.message).toMatch(/debug token/i);
    expect(debug.banner.message).not.toMatch(/site-key|AIza/);

    const recaptcha = resolveAnalysisAccess({
      missingFirebase: false,
      firebaseNotConfiguredMessage: NOT_CONFIGURED,
      decision: { kind: 'recaptcha-enterprise', siteKey: 'site-key' },
    });
    expect(recaptcha.useOnDevice).toBe(true);
    expect(recaptcha.useCloud).toBe(true);
    expect(recaptcha.banner.message).toMatch(/reCAPTCHA Enterprise/);
  });
});
