import { describe, expect, it } from 'vitest';
import { HYBRID_CREATE_OPTIONS, type DownloadMonitor, type LanguageModelClient } from './availability';
import { downloadOnDeviceModel } from './download';

describe('downloadOnDeviceModel', () => {
  it('prefers initializeDeviceModel and forwards progress', async () => {
    const seen: number[] = [];
    let created = false;
    const path = await downloadOnDeviceModel({
      initializeDeviceModel: async (onProgress) => {
        onProgress(0.25);
        onProgress(Number.NaN);
      },
      languageModel: {
        availability: () => Promise.resolve('downloadable'),
        create: () => {
          created = true;
          return Promise.resolve(undefined);
        },
      },
      onProgress: (fraction) => {
        seen.push(fraction);
      },
    });
    expect(path).toBe('firebase');
    expect(created).toBe(false);
    expect(seen).toEqual([0.25, 0]);
  });

  it('calls LanguageModel.create with a downloadprogress monitor when Firebase is absent', async () => {
    const seen: number[] = [];
    let options: Parameters<NonNullable<LanguageModelClient['create']>>[0] | undefined;
    const languageModel: LanguageModelClient = {
      availability: () => Promise.resolve('downloadable'),
      create(next) {
        options = next;
        const monitor: DownloadMonitor = {
          addEventListener(_type, listener) {
            listener({ loaded: 0.4 });
            listener({ loaded: 2 });
          },
        };
        next?.monitor?.(monitor);
        return Promise.resolve({ session: true });
      },
    };
    const path = await downloadOnDeviceModel({
      initializeDeviceModel: null,
      languageModel,
      onProgress: (fraction) => {
        seen.push(fraction);
      },
    });
    expect(path).toBe('language-model');
    expect(options?.expectedInputs).toEqual(HYBRID_CREATE_OPTIONS.expectedInputs);
    expect(seen).toEqual([0.4, 1]);
  });

  it('explains that rules still run when no download API exists', async () => {
    await expect(downloadOnDeviceModel({
      initializeDeviceModel: null,
      languageModel: null,
      onProgress: () => {},
    })).rejects.toThrow(/keyword rules/i);
  });
});
