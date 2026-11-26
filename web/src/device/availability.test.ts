import { describe, expect, it } from 'vitest';
import {
  browserAvailabilitySources,
  mapDeviceAvailability,
  probeDeviceAvailability,
  readBrowserLanguageModel,
  type LanguageModelClient,
} from './availability';

function languageModel(result: string | Error): LanguageModelClient {
  return {
    availability: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  };
}

describe('mapDeviceAvailability', () => {
  it('maps the Prompt API values onto the onboarding states', () => {
    expect(mapDeviceAvailability('available')).toBe('available');
    expect(mapDeviceAvailability('downloading')).toBe('downloading');
    expect(mapDeviceAvailability('downloadable')).toBe('downloadable');
    expect(mapDeviceAvailability('unavailable')).toBe('not-supported');
    expect(mapDeviceAvailability('something-else')).toBe('unknown');
    expect(mapDeviceAvailability(undefined)).toBe('unknown');
  });
});

describe('probeDeviceAvailability', () => {
  it('uses the hybrid probe when it returns a known state', async () => {
    let languageCalls = 0;
    const availability = await probeDeviceAvailability({
      hybrid: { availability: () => Promise.resolve('downloadable') },
      languageModel: {
        availability: () => {
          languageCalls += 1;
          return Promise.resolve('available');
        },
      },
    });
    expect(availability).toBe('downloadable');
    expect(languageCalls).toBe(0);
  });

  it('falls through to LanguageModel.availability when the hybrid probe throws', async () => {
    const availability = await probeDeviceAvailability({
      hybrid: { availability: () => Promise.reject(new Error('hybrid down')) },
      languageModel: languageModel('available'),
    });
    expect(availability).toBe('available');
  });

  it('reports unknown when the probe throws and no Prompt API remains', async () => {
    await expect(probeDeviceAvailability({
      hybrid: { availability: () => Promise.reject(new Error('hybrid down')) },
      languageModel: null,
    })).resolves.toBe('unknown');
  });

  it('reports not supported when the Prompt API is missing', async () => {
    await expect(probeDeviceAvailability({ hybrid: null, languageModel: null })).resolves.toBe('not-supported');
  });

  it('reports unknown when LanguageModel.availability throws', async () => {
    await expect(probeDeviceAvailability({
      languageModel: languageModel(new Error('blocked')),
    })).resolves.toBe('unknown');
  });
});

describe('readBrowserLanguageModel', () => {
  it('ignores a host with no availability function', () => {
    expect(readBrowserLanguageModel({})).toBeNull();
    const client = languageModel('available');
    expect(readBrowserLanguageModel({ LanguageModel: client })).toBe(client);
    expect(browserAvailabilitySources(null)).toEqual({ hybrid: null, languageModel: null });
  });
});
