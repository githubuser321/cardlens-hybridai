import { describe, expect, it } from 'vitest';
import { isBrowserOnline, readOnline, withTimeout } from './offline';

describe('offline', () => {
  it('treats a missing navigator as online and honors onLine', () => {
    expect(readOnline(undefined)).toBe(true);
    expect(readOnline({ onLine: true })).toBe(true);
    expect(readOnline({ onLine: false })).toBe(false);
    expect(isBrowserOnline()).toBe(true);
  });

  it('rejects a call that does not settle', async () => {
    await expect(withTimeout(new Promise(() => {}), 15)).rejects.toThrow(/offline/i);
  });
});
