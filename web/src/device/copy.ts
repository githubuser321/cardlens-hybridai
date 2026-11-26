import type { DeviceAvailability } from './availability';

export const ON_DEVICE_REQUIREMENTS =
  'On-device Gemini needs Chrome 148 or newer, the Prompt API flag turned on, and hardware that can run the model. CardLens still categorizes, compares months, and finds subscriptions with local rules in every other browser.';

export interface OnboardingCopy {
  badge: string;
  state: DeviceAvailability;
  status: string;
  requirements: string | null;
  downloadLabel: string;
  downloadEnabled: boolean;
  showDownload: boolean;
  showDismiss: boolean;
  showProgress: boolean;
  progressPercent: number;
}

export function onboardingCopy(input: {
  availability: DeviceAvailability;
  nag: boolean;
  progress: number | null;
  error: string | null;
}): OnboardingCopy {
  const base = copyFor(input.availability, input.nag, input.progress);
  if (!input.error) {
    return base;
  }
  return {
    ...base,
    status: input.error,
    showProgress: false,
    downloadEnabled: input.availability !== 'not-supported' && input.availability !== 'available',
  };
}

function copyFor(availability: DeviceAvailability, nag: boolean, progress: number | null): OnboardingCopy {
  const progressPercent = progress === null ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  switch (availability) {
    case 'available':
      return {
        badge: 'Available',
        state: availability,
        status: 'The on-device model is on this device. CardLens uses it when Firebase AI Logic is configured, and keyword rules otherwise. Rules never send the statement to the cloud.',
        requirements: null,
        downloadLabel: 'On-device model is ready',
        downloadEnabled: false,
        showDownload: false,
        showDismiss: false,
        showProgress: false,
        progressPercent: 100,
      };
    case 'downloading':
      return {
        badge: 'Downloading',
        state: availability,
        status: progress === null
          ? 'Downloading the on-device model. Keyword rules keep working while it downloads.'
          : `Downloading the on-device model… ${progressPercent}%. Keyword rules keep working while it downloads.`,
        requirements: null,
        downloadLabel: 'Downloading…',
        downloadEnabled: false,
        showDownload: false,
        showDismiss: false,
        showProgress: true,
        progressPercent,
      };
    case 'downloadable':
      return {
        badge: 'Downloadable',
        state: availability,
        status: nag
          ? 'The on-device model can be downloaded. Chrome starts the download only after you click. Until then, keyword rules categorize on this device.'
          : 'On-device model is not downloaded. Keyword rules are categorizing on this device.',
        requirements: null,
        downloadLabel: 'Download on-device model',
        downloadEnabled: true,
        showDownload: true,
        showDismiss: nag,
        showProgress: false,
        progressPercent: 0,
      };
    case 'not-supported':
      return {
        badge: 'Basic sorting',
        state: availability,
        status: 'AI on this device: Not available in this browser (basic sorting is used instead)',
        requirements: null,
        downloadLabel: 'Download unavailable',
        downloadEnabled: false,
        showDownload: false,
        showDismiss: false,
        showProgress: false,
        progressPercent: 0,
      };
    default:
      return {
        badge: 'Unknown',
        state: 'unknown',
        status: 'CardLens could not tell whether an on-device model is available. Keyword rules still run on this device.',
        requirements: null,
        downloadLabel: 'Check and download',
        downloadEnabled: true,
        showDownload: true,
        showDismiss: nag,
        showProgress: false,
        progressPercent: 0,
      };
  }
}
