import { describe, expect, it, vi } from 'vitest';
import { createGatedModel } from '../analyze/gated-model';
import {
  CLOUD_IMAGE_BODY_EN,
  CLOUD_IMAGE_CHECK_EN,
  CLOUD_TEXT_BODY_EN,
  CLOUD_TEXT_KEEP_EN,
  CLOUD_TEXT_SEND_EN,
  CLOUD_TEXT_TITLE_EN,
  FREE_TIER_TEXT_SENTENCE_EN,
} from './copy';
import { decideCloudFallback, parseCloudFallback } from './cloud-gate';
import {
  readConsent,
  recordConsentChoice,
  textCloudPermission,
  writeConsent,
  type StorageLike,
} from './consent-store';
import { clearStoredData, expireCookieHeader } from './clear-data';
import { rewriteRecaptchaUrl } from './recaptcha-net';
import { assessRegion } from './region';
import { CONSENT_STORAGE_KEY, LOCAL_STORAGE_KEYS, STORAGE_INVENTORY } from './storage-inventory';

describe('region and cloud gate', () => {
  it('treats EEA, UK, and Swiss signals as restricted and leaves Israel and the US open', () => {
    expect(assessRegion({ locales: ['de-DE'], timeZone: 'Europe/Berlin' }).restricted).toBe(true);
    expect(assessRegion({ locales: ['en-GB'], timeZone: 'Asia/Jerusalem' }).restricted).toBe(true);
    expect(assessRegion({ locales: ['en-US'], timeZone: 'Europe/Zurich' }).matchedTimeZone).toBe('Europe/Zurich');
    expect(assessRegion({ locales: ['fr-CH'], timeZone: 'Asia/Jerusalem' }).matchedLocale).toBe('CH');
    expect(assessRegion({ locales: ['he-IL'], timeZone: 'Asia/Jerusalem' }).restricted).toBe(false);
    expect(assessRegion({ locales: ['en-US'], timeZone: 'America/New_York' }).restricted).toBe(false);
    expect(assessRegion({ locales: ['en'], timeZone: 'Europe/Istanbul' }).restricted).toBe(false);
    expect(assessRegion({ locales: [], timeZone: null }).hasSignal).toBe(false);
  });

  it('fails closed for a restricted browser and for a bad Remote Config value', () => {
    const restricted = { locales: ['de-DE'], timeZone: 'Europe/Berlin' };
    expect(decideCloudFallback({
      remoteFetched: false,
      remoteValue: null,
      signals: restricted,
    })).toEqual({ enabled: false, reason: 'fetch-failed-restricted' });
    expect(decideCloudFallback({
      remoteFetched: true,
      remoteValue: true,
      signals: restricted,
    }).enabled).toBe(false);

    const open = { locales: ['en-US'], timeZone: 'America/New_York' };
    expect(decideCloudFallback({
      remoteFetched: true,
      remoteValue: true,
      signals: open,
    })).toEqual({ enabled: true, reason: 'remote-on' });
    expect(decideCloudFallback({
      remoteFetched: true,
      remoteValue: false,
      signals: open,
    }).reason).toBe('remote-off');
    expect(decideCloudFallback({
      remoteFetched: true,
      remoteValue: parseCloudFallback('maybe'),
      signals: open,
    }).reason).toBe('remote-unrecognized');
    expect(decideCloudFallback({
      remoteFetched: false,
      remoteValue: null,
      signals: open,
    }).reason).toBe('fetch-failed-open');
    expect(decideCloudFallback({
      remoteFetched: false,
      remoteValue: null,
      signals: { locales: ['en'], timeZone: null },
    }).reason).toBe('fetch-failed-no-signal');
  });
});

describe('consent copy and storage', () => {
  it('uses the free-tier sentences and does not claim that Google skips training', () => {
    expect(CLOUD_TEXT_TITLE_EN).toBe('Analyze in the cloud?');
    expect(CLOUD_TEXT_BODY_EN).toContain(FREE_TIER_TEXT_SENTENCE_EN);
    expect(CLOUD_TEXT_KEEP_EN).toBe('Keep it on my device');
    expect(CLOUD_TEXT_SEND_EN).toBe('Send redacted text');
    expect(CLOUD_IMAGE_CHECK_EN).toBe('I understand and want to send this image.');
    expect(CLOUD_IMAGE_BODY_EN).toMatch(/human reviewers may read it/);
    expect(`${CLOUD_TEXT_BODY_EN} ${CLOUD_IMAGE_BODY_EN}`).not.toMatch(/does not use it to train|doesn't use it to train/i);
  });

  it('stores a timestamp and text version and can withdraw cloud use', () => {
    const memory = memoryStore();
    const saved = recordConsentChoice(readConsent(memory), {
      kind: 'cloud-text',
      decision: 'granted',
      at: '2026-11-15T12:00:00.000Z',
      locale: 'en',
    });
    writeConsent(memory, { ...saved, preference: 'never' });
    const loaded = readConsent(memory);
    expect(loaded.preference).toBe('never');
    expect(loaded.records[0]).toMatchObject({
      kind: 'cloud-text',
      decision: 'granted',
      at: '2026-11-15T12:00:00.000Z',
      textVersion: '2026-11-15-free-b',
    });
    expect(JSON.stringify(loaded)).not.toMatch(/4111|Dana/);
    expect(textCloudPermission(loaded, { text: 'granted' })).toBe('deny');
    expect(textCloudPermission({ preference: 'ask', records: [] }, { text: 'unset' })).toBe('ask');
    expect(textCloudPermission({ preference: 'ask', records: [] }, { text: 'granted' })).toBe('allow');
    expect(textCloudPermission({ preference: 'ask', records: [] }, { text: 'off' })).toBe('deny');
    expect(textCloudPermission({ preference: 'never', records: [] }, { text: 'unset' })).toBe('deny');
    expect(memory.getItem(CONSENT_STORAGE_KEY)).toContain('2026-11-15-free-b');
  });

  it('lists every CardLens storage key in the inventory', () => {
    for (const key of LOCAL_STORAGE_KEYS) {
      expect(STORAGE_INVENTORY.some((row) => row.name === key)).toBe(true);
    }
    expect(STORAGE_INVENTORY.map((row) => row.name)).toEqual(expect.arrayContaining([
      'firebase-installations-database',
      'firebase-app-check-database',
      'firebase_remote_config',
      'firebase-heartbeat-database',
      'cardlens-shell-v4',
      '_GRECAPTCHA',
    ]));
  });
});

describe('clear data and recaptcha host', () => {
  it('deletes the installation record before IndexedDB and empties storage', async () => {
    const order: string[] = [];
    const local = memoryStore();
    local.setItem('cardlens.consent.v1', '{}');
    local.setItem('other', '1');
    const result = await clearStoredData({
      localStorage: local,
      sessionStorage: null,
      databaseNames: ['firebase-installations-database'],
      deleteDatabase: async (name) => {
        order.push(`db:${name}`);
      },
      cacheNames: ['cardlens-shell-v4'],
      deleteCache: async (name) => {
        order.push(`cache:${name}`);
      },
      expireCookies() {
        order.push('cookies');
      },
      async deleteInstallations() {
        order.push('installations');
        return 'deleted';
      },
      async unregisterWorkers() {
        order.push('unregister');
      },
      async reregisterWorker() {
        order.push('register');
      },
    });
    expect(order[0]).toBe('installations');
    expect(order).toContain('db:firebase-installations-database');
    expect(result.installationDeleted).toBe(true);
    expect(result.installationError).toBeNull();
    expect(result.partial).toBe(false);
    expect(result.databases).toEqual(['firebase-installations-database']);
    expect(result.storageKeys).toEqual(['cardlens.consent.v1', 'other']);
    expect(local.length).toBe(0);
    expect(expireCookieHeader('_GRECAPTCHA=1; other=2')).toEqual([
      '_GRECAPTCHA=; Max-Age=0; path=/',
      'other=; Max-Age=0; path=/',
    ]);
  });

  it('still clears storage when a later step fails', async () => {
    const local = memoryStore();
    local.setItem('cardlens.consent.v1', '{}');
    const result = await clearStoredData({
      localStorage: local,
      sessionStorage: null,
      databaseNames: ['firebase-app-check-database'],
      deleteDatabase: async () => {
        throw new Error('database blocked');
      },
      cacheNames: ['cardlens-shell-v4'],
      deleteCache: async () => {
        throw new Error('cache failed');
      },
      expireCookies() {
        // Cookies still run after a failed database delete.
      },
      async deleteInstallations() {
        return 'skipped';
      },
      async unregisterWorkers() {
        throw new Error('unregister failed');
      },
      async reregisterWorker() {
        // Reached even after unregister fails.
      },
    });
    expect(result.installationDeleted).toBe(false);
    expect(result.installationError).toBeNull();
    expect(result.partial).toBe(true);
    expect(result.databases).toEqual([]);
    expect(result.caches).toEqual([]);
    expect(result.storageKeys).toEqual(['cardlens.consent.v1']);
    expect(local.length).toBe(0);
  });

  it('finishes and clears storage when installation, databases, and workers hang', async () => {
    vi.useFakeTimers();
    try {
      const local = memoryStore();
      local.setItem('cardlens.consent.v1', '{}');
      const session = memoryStore();
      session.setItem('cardlens.cloud-session.v1', '1');
      let cookies = 0;
      const pending = clearStoredData({
        localStorage: local,
        sessionStorage: session,
        databaseNames: ['firebase-installations-database', 'firebase-app-check-database'],
        deleteDatabase: () => new Promise(() => {}),
        cacheNames: ['cardlens-shell-v4'],
        deleteCache: () => new Promise(() => {}),
        expireCookies() {
          cookies += 1;
        },
        deleteInstallations: () => new Promise(() => {}),
        unregisterWorkers: () => new Promise(() => {}),
        reregisterWorker: () => new Promise(() => {}),
      }, { stepTimeoutMs: 400, budgetMs: 1_000 });
      const done = pending.then((result) => result);
      await vi.advanceTimersByTimeAsync(1_000);
      const result = await done;
      expect(result.partial).toBe(true);
      expect(result.installationDeleted).toBe(false);
      expect(result.installationError).toMatch(/timed out/i);
      expect(result.databases).toEqual([]);
      expect(local.length).toBe(0);
      expect(session.length).toBe(0);
      expect(cookies).toBe(1);
      expect(result.storageKeys).toEqual(['cardlens.consent.v1', 'cardlens.cloud-session.v1']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the enterprise script to www.recaptcha.net', () => {
    expect(rewriteRecaptchaUrl('https://www.google.com/recaptcha/enterprise.js?render=explicit'))
      .toBe('https://www.recaptcha.net/recaptcha/enterprise.js?render=explicit');
    expect(rewriteRecaptchaUrl('https://www.google.com/recaptcha/api.js'))
      .toBe('https://www.recaptcha.net/recaptcha/api.js');
    expect(rewriteRecaptchaUrl('https://example.com/app.js')).toBe('https://example.com/app.js');
  });
});

function gatedDeps(overrides: Partial<Parameters<typeof createGatedModel>[0]> = {}) {
  return {
    onDevice: {
      async generateContent() {
        return { text: 'device', inferenceSource: 'on_device' };
      },
    },
    openHybrid: async () => ({
      async generateContent() {
        return { text: 'hybrid', inferenceSource: 'in_cloud' };
      },
    }),
    consentGranted: () => false,
    regionAllowed: true,
    cloudFallbackEnabled: true,
    blockedMessage: 'blocked',
    requestConsent: async () => false,
    ...overrides,
  };
}

describe('gated cloud calls', () => {
  it('stays on the device when consent is missing and does not open the hybrid model', async () => {
    let hybridOpens = 0;
    const model = createGatedModel(gatedDeps({
      openHybrid: async () => {
        hybridOpens += 1;
        return { async generateContent() { return { text: 'cloud', inferenceSource: 'in_cloud' }; } };
      },
    }));
    await expect(model.generateContent('redacted')).resolves.toMatchObject({ inferenceSource: 'on_device' });
    expect(hybridOpens).toBe(0);
  });

  it('does not open the hybrid model when consent is refused or the region or flag is closed', async () => {
    let hybridOpens = 0;
    const openHybrid = async () => {
      hybridOpens += 1;
      return { async generateContent(prompt: string) { return { text: prompt, inferenceSource: 'in_cloud' }; } };
    };
    const declined = createGatedModel(gatedDeps({
      onDevice: { async generateContent() { throw new Error('no model'); } },
      openHybrid,
      requestConsent: async () => false,
    }));
    await expect(declined.generateContent('same redacted prompt')).rejects.toThrow(/not sent/i);

    const regionBlocked = createGatedModel(gatedDeps({
      onDevice: { async generateContent() { throw new Error('no model'); } },
      openHybrid,
      regionAllowed: false,
      requestConsent: async () => true,
    }));
    await expect(regionBlocked.generateContent('prompt')).rejects.toThrow(/blocked/);

    const flagOff = createGatedModel(gatedDeps({
      onDevice: { async generateContent() { throw new Error('no model'); } },
      openHybrid,
      cloudFallbackEnabled: false,
      consentGranted: () => true,
    }));
    await expect(flagOff.generateContent('prompt')).rejects.toThrow(/blocked/);
    expect(hybridOpens).toBe(0);
  });

  it('uses the hybrid model with the same redacted prompt after consent, and keeps a cloud source', async () => {
    const seen: string[] = [];
    const model = createGatedModel(gatedDeps({
      onDevice: { async generateContent() { throw new Error('no model'); } },
      openHybrid: async () => ({
        async generateContent(prompt: string) {
          seen.push(prompt);
          return { text: 'categories', inferenceSource: 'in_cloud' };
        },
      }),
      requestConsent: async () => true,
    }));
    await expect(model.generateContent('merchant [REDACTED_NAME]')).resolves.toMatchObject({
      inferenceSource: 'in_cloud',
    });
    expect(seen).toEqual(['merchant [REDACTED_NAME]']);
  });

  it('skips the on-device-only model when consent is already granted', async () => {
    let deviceCalls = 0;
    const model = createGatedModel(gatedDeps({
      onDevice: {
        async generateContent() {
          deviceCalls += 1;
          return { text: 'device', inferenceSource: 'on_device' };
        },
      },
      consentGranted: () => true,
      openHybrid: async () => ({
        async generateContent() {
          return { text: 'on device via hybrid', inferenceSource: 'on_device' };
        },
      }),
    }));
    await expect(model.generateContent('redacted')).resolves.toMatchObject({ inferenceSource: 'on_device' });
    expect(deviceCalls).toBe(0);
  });

  it('sends the same redacted prompt once and does not retry after a hybrid failure', async () => {
    const seen: string[] = [];
    const model = createGatedModel(gatedDeps({
      onDevice: { async generateContent() { throw new Error('no model'); } },
      openHybrid: async () => ({
        async generateContent(prompt: string) {
          seen.push(prompt);
          throw new Error('cloud unavailable');
        },
      }),
      requestConsent: async () => true,
    }));
    await expect(model.generateContent('merchant [REDACTED_NAME]')).rejects.toThrow(/cloud unavailable/);
    expect(seen).toEqual(['merchant [REDACTED_NAME]']);
  });

  it('discards an unexpected cloud result from the on-device-only path', async () => {
    let hybridOpens = 0;
    const model = createGatedModel(gatedDeps({
      onDevice: { async generateContent() { return { text: 'leaked', inferenceSource: 'in_cloud' }; } },
      openHybrid: async () => {
        hybridOpens += 1;
        return { async generateContent() { return { text: 'again', inferenceSource: 'in_cloud' }; } };
      },
      requestConsent: async () => true,
    }));
    await expect(model.generateContent('prompt')).rejects.toThrow(/discarded/i);
    expect(hybridOpens).toBe(0);
  });
});

function memoryStore(): StorageLike & { length: number; key(index: number): string | null; removeItem(key: string): void } {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}
