import { safeTechnicalDetail } from '../compliance/cloud-outcome';
import { CloudNotSentError, IMAGE_NOT_SENT_MESSAGE } from '../compliance/errors';

export const SCAN_CLOUD_FAILED_MESSAGE =
  "We couldn't read this scan in the cloud right now. Nothing was sent. Try a text PDF, or try again later.";

/**
 * Friendly scan failure. A declined send and the Settings path (cloud not allowed)
 * keep their own sentences. A failed cloud read hides raw 401 text behind Details.
 */
export function presentScanFailure(error: unknown, secret = ''): { message: string; detail: string | null } {
  if (error instanceof CloudNotSentError) {
    return { message: error.message || IMAGE_NOT_SENT_MESSAGE, detail: null };
  }
  const raw = error instanceof Error ? error.message : 'The scan could not be read.';
  return {
    message: SCAN_CLOUD_FAILED_MESSAGE,
    detail: safeTechnicalDetail(raw, secret),
  };
}

/** Cloud fallback for a scan is allowed only when the user opted in and the browser is online. */
export function scanUsesCloud(allowCloud: boolean, online: boolean): boolean {
  return allowCloud && online;
}

/**
 * A scan may call the hybrid model when on-device inference is ready,
 * or when the user allowed the cloud fallback.
 * The model itself still prefers on-device.
 */
export function scanCallAllowed(options: {
  allowCloud: boolean;
  online: boolean;
  onDeviceAvailable: boolean;
}): boolean {
  return options.onDeviceAvailable || scanUsesCloud(options.allowCloud, options.online);
}

export function scanBlockedMessage(options: {
  configured: boolean;
  online: boolean;
  allowCloud: boolean;
  cloudDisabled?: boolean;
  regionBlocked?: boolean;
}): string {
  if (options.regionBlocked) {
    return 'Cloud analysis is off for the EEA, the UK, and Switzerland while CardLens uses the free Gemini tier. This image was not sent. On-device reading and keyword rules still run.';
  }
  if (!options.online) {
    return 'You are offline. Scanned pages need the on-device model. Text PDFs still parse on this device.';
  }
  if (options.cloudDisabled) {
    return 'Cloud model calls are off because App Check is not configured. This scan was not sent. Text PDFs still parse with on-device rules.';
  }
  if (!options.configured) {
    return 'This scan needs the on-device model. An image cannot be redacted as text, and nothing was sent. Text PDFs still parse on this device.';
  }
  if (!options.allowCloud) {
    return 'The on-device model could not read this scan. An image cannot be redacted, so it was not sent to the cloud. In Settings, choose Always ask and agree to send the image, or use a text PDF.';
  }
  return 'The model could not read this scan.';
}
