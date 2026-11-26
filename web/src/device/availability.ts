/**
 * On-device availability for the hybrid Firebase AI Logic path.
 *
 * The Chrome adapter inside `initializeDeviceModel` calls
 * `LanguageModel.availability()` before it downloads. This module uses that
 * same check, then the Prompt API directly when the hybrid probe cannot answer.
 * Keyword rules still categorize when the result is not `available`.
 */

export type DeviceAvailability =
  | 'available'
  | 'downloading'
  | 'downloadable'
  | 'not-supported'
  | 'unknown';

/** Matches the inputs the hybrid adapter requests when create options are omitted. */
export const HYBRID_CREATE_OPTIONS = {
  expectedInputs: [
    { type: 'text', languages: ['en'] },
    { type: 'image' },
  ],
  expectedOutputs: [
    { type: 'text', languages: ['en'] },
  ],
} as const;

export interface DownloadMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: { loaded: number }) => void,
  ): void;
}

export interface LanguageModelClient {
  availability(options?: object): Promise<string>;
  create?(options?: {
    monitor?: (monitor: DownloadMonitor) => void;
    expectedInputs?: readonly { type: string; languages?: readonly string[] }[];
    expectedOutputs?: readonly { type: string; languages?: readonly string[] }[];
  }): Promise<unknown>;
}

export interface HybridAvailabilityProbe {
  availability(): Promise<string>;
}

const KNOWN: ReadonlySet<DeviceAvailability> = new Set([
  'available',
  'downloading',
  'downloadable',
  'not-supported',
]);

export function mapDeviceAvailability(raw: string | null | undefined): DeviceAvailability {
  switch (raw) {
    case 'available':
    case 'downloading':
    case 'downloadable':
      return raw;
    case 'unavailable':
      return 'not-supported';
    default:
      return 'unknown';
  }
}

export function isDeviceAvailability(value: string): value is DeviceAvailability {
  return KNOWN.has(value as DeviceAvailability);
}

/**
 * Hybrid probe first. `unknown` or a thrown probe falls through to
 * `LanguageModel.availability()`. No Prompt API at all means not supported.
 */
export async function probeDeviceAvailability(sources: {
  hybrid?: HybridAvailabilityProbe | null;
  languageModel?: LanguageModelClient | null;
}): Promise<DeviceAvailability> {
  const hybrid = sources.hybrid ?? null;
  if (hybrid) {
    try {
      const mapped = mapDeviceAvailability(await hybrid.availability());
      if (mapped !== 'unknown') {
        return mapped;
      }
    } catch {
      if (!sources.languageModel) {
        return 'unknown';
      }
    }
  }

  const languageModel = sources.languageModel ?? null;
  if (!languageModel || typeof languageModel.availability !== 'function') {
    return hybrid ? 'unknown' : 'not-supported';
  }
  try {
    return mapDeviceAvailability(await languageModel.availability(HYBRID_CREATE_OPTIONS));
  } catch {
    return 'unknown';
  }
}

export function readBrowserLanguageModel(
  host: { LanguageModel?: LanguageModelClient } = globalThis as { LanguageModel?: LanguageModelClient },
): LanguageModelClient | null {
  const candidate = host.LanguageModel;
  if (!candidate || typeof candidate.availability !== 'function') {
    return null;
  }
  return candidate;
}

/** The hybrid probe is the Prompt API call the Chrome adapter makes. */
export function browserAvailabilitySources(
  languageModel: LanguageModelClient | null = readBrowserLanguageModel(),
): { hybrid: HybridAvailabilityProbe | null; languageModel: LanguageModelClient | null } {
  if (!languageModel) {
    return { hybrid: null, languageModel: null };
  }
  return {
    hybrid: { availability: () => languageModel.availability(HYBRID_CREATE_OPTIONS) },
    languageModel,
  };
}
