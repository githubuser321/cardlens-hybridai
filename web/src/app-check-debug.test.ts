import { describe, expect, it } from 'vitest';
import { applyAppCheckDebugToken } from './app-check-debug';

describe('applyAppCheckDebugToken', () => {
  it('does not set the debug token when not DEV', () => {
    const target: { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean } = {};

    applyAppCheckDebugToken(false, 'should-not-apply', target);

    expect(target.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('does not throw when self is unavailable outside dev', () => {
    expect(() => applyAppCheckDebugToken(false, 'should-not-apply', undefined)).not.toThrow();
  });

  it('uses the configured token in dev and true when it is absent', () => {
    const target: { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean } = {};

    applyAppCheckDebugToken(true, '  debug-token  ', target);
    expect(target.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('debug-token');

    applyAppCheckDebugToken(true, '   ', target);
    expect(target.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });
});
