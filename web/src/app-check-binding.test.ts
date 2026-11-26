import { describe, expect, it } from 'vitest';
import {
  APP_CHECK_TOKEN_ATTEMPTS,
  cloudAppCheckFailureMessage,
  hybridAiAllowed,
  isUsableAppCheckToken,
  resetCloudWarn,
  warnCloudFailure,
} from './app-check-binding';

function jwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value))
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}

describe('hybrid AI binding', () => {
  it('refuses an AI instance created before App Check init', () => {
    expect(hybridAiAllowed('before-app-check')).toBe(false);
    expect(hybridAiAllowed('after-app-check')).toBe(true);
  });
});

describe('App Check token shape', () => {
  it('accepts a three-segment JWT and rejects placeholder blobs', () => {
    expect(isUsableAppCheckToken(jwt({ exp: 1 }))).toBe(true);
    expect(isUsableAppCheckToken(`  ${jwt({ sub: 'app' })}  `)).toBe(true);
    expect(isUsableAppCheckToken(jwt({ error: 'UNKNOWN_ERROR' }))).toBe(false);
    expect(isUsableAppCheckToken(btoa(JSON.stringify({ error: 'UNKNOWN_ERROR' })))).toBe(false);
    expect(isUsableAppCheckToken('')).toBe(false);
    expect(isUsableAppCheckToken('not-a-jwt')).toBe(false);
    expect(isUsableAppCheckToken('a.b')).toBe(false);
    expect(isUsableAppCheckToken('a..c')).toBe(false);
    expect(isUsableAppCheckToken(null)).toBe(false);
    expect(isUsableAppCheckToken(undefined)).toBe(false);
    expect(APP_CHECK_TOKEN_ATTEMPTS).toBeGreaterThan(1);
  });

  it('keeps token material out of the cloud failure message', () => {
    const token = jwt({ exp: 99 });
    const message = cloudAppCheckFailureMessage(new Error(`exchange failed ${token}`));
    expect(message).toMatch(/cloud model was not called/);
    expect(message).toContain('[token]');
    expect(message).not.toContain(token);
    expect(cloudAppCheckFailureMessage(new Error('Firebase: Error (app-check/recaptcha-error).')))
      .toContain('recaptcha-error');
    expect(cloudAppCheckFailureMessage('nope')).toBe(
      'App Check did not return a usable token, so the cloud model was not called.',
    );
  });

  it('warns with the error name and code and strips tokens', () => {
    const token = jwt({ exp: 1 });
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };
    try {
      const error = Object.assign(new Error(`exchange failed ${token}`), { code: 'appCheck/recaptcha-error' });
      error.name = 'FirebaseError';
      warnCloudFailure(error);
    } finally {
      console.warn = original;
    }
    expect(warnings[0]).toContain('FirebaseError');
    expect(warnings[0]).toContain('appCheck/recaptcha-error');
    expect(warnings[0]).toContain('[token]');
    expect(warnings[0]).not.toContain(token);
  });

  it('logs one warning per cloud send', () => {
    resetCloudWarn();
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };
    try {
      const first = Object.assign(new Error('ReCAPTCHA error'), { code: 'app-check/recaptcha-error' });
      first.name = 'FirebaseError';
      warnCloudFailure(first);
      warnCloudFailure(new Error('App Check did not return a usable token'));
    } finally {
      console.warn = original;
    }
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('FirebaseError');
    expect(warnings[0]).toContain('app-check/recaptcha-error');
  });
});
