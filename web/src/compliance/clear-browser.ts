import { deleteInstallations as deleteFirebaseInstallations, getInstallations } from 'firebase/installations';
import { getFirebaseApp, missingFirebaseEnv } from '../firebase';
import {
  CLEAR_BUDGET_MS,
  CLEAR_STEP_TIMEOUT_MS,
  clearStoredData,
  expireCookieHeader,
  namesToDelete,
  withStepTimeout,
  type ClearDataResult,
} from './clear-data';
import { INDEXED_DB_NAMES } from './storage-inventory';

interface DatabaseListing {
  databases?: () => Promise<ReadonlyArray<{ name?: string | null }>>;
}

/** Browser entry for Settings → Clear my data. Installation id is deleted before IndexedDB. */
export async function clearBrowserData(): Promise<ClearDataResult> {
  const started = Date.now();
  const remaining = (): number => Math.max(0, CLEAR_BUDGET_MS - (Date.now() - started));
  const listed = await listDatabaseNames(indexedDbListing(), remaining());
  const caches = await listCacheNames(remaining());
  return clearStoredData({
    localStorage: browserStorage(localStorage),
    sessionStorage: browserStorage(sessionStorage),
    databaseNames: namesToDelete(INDEXED_DB_NAMES, listed),
    deleteDatabase: deleteDatabase,
    cacheNames: caches,
    deleteCache: async (name) => {
      await cachesDelete(name);
    },
    expireCookies() {
      if (typeof document === 'undefined') {
        return;
      }
      for (const header of expireCookieHeader(document.cookie)) {
        document.cookie = header;
      }
    },
    async deleteInstallations() {
      if (missingFirebaseEnv().length > 0) {
        return 'skipped';
      }
      await deleteFirebaseInstallations(getInstallations(getFirebaseApp()));
      return 'deleted';
    },
    async unregisterWorkers() {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return;
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    },
    async reregisterWorker() {
      if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return;
      }
      await navigator.serviceWorker.register('/sw.js');
    },
  }, {
    stepTimeoutMs: CLEAR_STEP_TIMEOUT_MS,
    budgetMs: remaining(),
  });
}

function browserStorage(store: Storage | undefined): Storage | null {
  try {
    return store ?? null;
  } catch {
    return null;
  }
}

function indexedDbListing(): DatabaseListing | undefined {
  if (typeof indexedDB === 'undefined') {
    return undefined;
  }
  return indexedDB;
}

/**
 * Known names are used when listing is missing or does not settle.
 * `indexedDB.databases()` can hang while Firebase keeps a connection open.
 */
export async function listDatabaseNames(
  indexed: DatabaseListing | undefined,
  timeoutMs: number,
): Promise<string[] | null> {
  if (!indexed || typeof indexed.databases !== 'function') {
    return null;
  }
  try {
    const databases = await withStepTimeout(indexed.databases(), timeoutMs, 'indexedDB.databases');
    return databases.flatMap((database) => (database.name ? [database.name] : []));
  } catch {
    return null;
  }
}

async function listCacheNames(timeoutMs: number): Promise<string[]> {
  if (typeof caches === 'undefined' || timeoutMs <= 0) {
    return [];
  }
  try {
    return await withStepTimeout(caches.keys(), timeoutMs, 'caches.keys');
  } catch {
    return [];
  }
}

/**
 * Resolves on success or `blocked`. Chrome can also fire neither event while a
 * Firebase App Check or Installations connection stays open; the caller times
 * that out and continues with the other steps.
 */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    const fail = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error instanceof Error ? error : new Error(`Could not delete ${name}`));
    };
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => finish();
      request.onerror = () => fail(request.error ?? new Error(`Could not delete ${name}`));
      request.onblocked = () => finish();
    } catch (error) {
      fail(error);
    }
  });
}

function cachesDelete(name: string): Promise<void> {
  return caches.delete(name).then(() => undefined);
}
