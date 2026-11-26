import { describe, expect, it, vi } from 'vitest';
import { listDatabaseNames } from './clear-browser';

describe('indexedDB listing', () => {
  it('returns names when databases() settles', async () => {
    const names = await listDatabaseNames({
      async databases() {
        return [{ name: 'firebase-app-check-database' }, { name: null }, {}];
      },
    }, 50);
    expect(names).toEqual(['firebase-app-check-database']);
  });

  it('returns null when databases() never settles, so known names can still be deleted', async () => {
    vi.useFakeTimers();
    try {
      const pending = listDatabaseNames({
        databases: () => new Promise(() => {}),
      }, 200);
      const done = pending.then((value) => value);
      await vi.advanceTimersByTimeAsync(200);
      await expect(done).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when the browser has no databases() helper', async () => {
    await expect(listDatabaseNames(undefined, 20)).resolves.toBeNull();
    await expect(listDatabaseNames({}, 20)).resolves.toBeNull();
  });
});
