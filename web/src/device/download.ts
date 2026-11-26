import { HYBRID_CREATE_OPTIONS, type LanguageModelClient } from './availability';

export type DownloadPath = 'firebase' | 'language-model';

/**
 * User-gesture download.
 * `initializeDeviceModel` is the Firebase AI Logic hybrid entry: it calls
 * `LanguageModel.create` and forwards `downloadprogress`. When Firebase is not
 * configured, the same Prompt API create call runs directly.
 */
export async function downloadOnDeviceModel(input: {
  initializeDeviceModel?: ((onProgress: (fraction: number) => void) => Promise<void>) | null;
  languageModel?: LanguageModelClient | null;
  onProgress: (fraction: number) => void;
}): Promise<DownloadPath> {
  if (input.initializeDeviceModel) {
    await input.initializeDeviceModel((fraction) => {
      input.onProgress(clampProgress(fraction));
    });
    return 'firebase';
  }

  const languageModel = input.languageModel ?? null;
  if (!languageModel?.create) {
    throw new Error(
      'This browser cannot download the on-device model. Keyword rules still run on this device.',
    );
  }

  await languageModel.create({
    ...HYBRID_CREATE_OPTIONS,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        input.onProgress(clampProgress(event.loaded));
      });
    },
  });
  return 'language-model';
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
