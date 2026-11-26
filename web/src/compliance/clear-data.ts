import { INDEXED_DB_NAMES } from './storage-inventory';

export interface ClearableStorage {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export interface ClearDataDeps {
  localStorage: ClearableStorage | null;
  sessionStorage: ClearableStorage | null;
  databaseNames: readonly string[];
  deleteDatabase: (name: string) => Promise<void>;
  cacheNames: readonly string[];
  deleteCache: (name: string) => Promise<void>;
  expireCookies: () => void;
  deleteInstallations: () => Promise<'deleted' | 'skipped'>;
  unregisterWorkers: () => Promise<void>;
  reregisterWorker: () => Promise<void>;
}

export interface ClearDataResult {
  storageKeys: string[];
  databases: string[];
  caches: string[];
  installationDeleted: boolean;
  installationError: string | null;
  /** A step timed out or failed. Storage was still cleared when that was possible. */
  partial: boolean;
}

/** Per-step cap so one hung Firebase or IndexedDB call cannot stall the rest. */
export const CLEAR_STEP_TIMEOUT_MS = 2_000;

/** Wall-clock budget for listing plus every clear step. */
export const CLEAR_BUDGET_MS = 8_000;

/**
 * UI backstop, longer than {@link CLEAR_BUDGET_MS}, so the button cannot stay
 * on "Clearing…" if a dependency hangs outside the stepped budget.
 */
export const CLEAR_UI_BUDGET_MS = 10_000;

export class ClearStepTimeoutError extends Error {
  readonly step: string;

  constructor(step: string) {
    super(`${step} timed out`);
    this.name = 'ClearStepTimeoutError';
    this.step = step;
  }
}

export interface ClearStoredDataOptions {
  stepTimeoutMs?: number;
  budgetMs?: number;
}

/** Rejects when `task` does not settle within `ms`. A later settlement is ignored. */
export function withStepTimeout<T>(task: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ClearStepTimeoutError(step));
    }, ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(`${step} failed`));
      },
    );
  });
}

/** Deletes origin storage. Installation deletion runs first, while IndexedDB still holds the id. */
export async function clearStoredData(
  deps: ClearDataDeps,
  options: ClearStoredDataOptions = {},
): Promise<ClearDataResult> {
  const stepTimeoutMs = options.stepTimeoutMs ?? CLEAR_STEP_TIMEOUT_MS;
  const budgetMs = options.budgetMs ?? CLEAR_BUDGET_MS;
  const started = Date.now();
  const failures: string[] = [];

  async function runStep<T>(step: string, task: () => Promise<T>): Promise<T> {
    const left = budgetMs - (Date.now() - started);
    if (left <= 0) {
      throw new ClearStepTimeoutError(step);
    }
    return withStepTimeout(task(), Math.min(stepTimeoutMs, left), step);
  }

  async function attempt(step: string, task: () => Promise<void>): Promise<boolean> {
    try {
      await runStep(step, task);
      return true;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${step} failed`);
      return false;
    }
  }

  let installationDeleted = false;
  let installationError: string | null = null;
  try {
    installationDeleted = (await runStep('deleteInstallations', () => deps.deleteInstallations())) === 'deleted';
  } catch (error) {
    installationError = error instanceof Error ? error.message : 'deleteInstallations failed';
    failures.push(installationError);
  }

  const databases: string[] = [];
  for (const name of uniqueNames(deps.databaseNames)) {
    const removed = await attempt(`deleteDatabase ${name}`, () => deps.deleteDatabase(name));
    if (removed) {
      databases.push(name);
    }
  }

  const caches: string[] = [];
  for (const name of uniqueNames(deps.cacheNames)) {
    const removed = await attempt(`deleteCache ${name}`, () => deps.deleteCache(name));
    if (removed) {
      caches.push(name);
    }
  }

  let storageKeys: string[] = [];
  try {
    storageKeys = [
      ...clearStorage(deps.localStorage),
      ...clearStorage(deps.sessionStorage),
    ];
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'clearStorage failed');
  }

  try {
    deps.expireCookies();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'expireCookies failed');
  }

  await attempt('unregisterWorkers', () => deps.unregisterWorkers());
  await attempt('reregisterWorker', () => deps.reregisterWorker());

  return {
    storageKeys,
    databases,
    caches,
    installationDeleted,
    installationError,
    partial: failures.length > 0,
  };
}

export function namesToDelete(known: readonly string[], listed: readonly string[] | null): string[] {
  return uniqueNames([...(listed ?? []), ...known]);
}

export function knownDatabaseNames(): readonly string[] {
  return INDEXED_DB_NAMES;
}

export function clearStorage(store: ClearableStorage | null): string[] {
  if (!store) {
    return [];
  }
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    store.removeItem(key);
  }
  return keys;
}

export function expireCookieHeader(cookie: string): string[] {
  return cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => name.length > 0)
    .map((name) => `${name}=; Max-Age=0; path=/`);
}

function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    result.push(name);
  }
  return result;
}
