import {
  CloudNotSentError,
  IMAGE_NOT_SENT_MESSAGE,
  UNCONSENTED_CLOUD_MESSAGE,
} from '../compliance/errors';
import { INFERENCE_PREFER_ON_DEVICE, selectInferenceMode } from '../compliance/inference-mode';
import { formatInferenceSource } from '../inference-source';

export interface ScanAttempt {
  text: string;
  inferenceSource?: string;
}

/**
 * Image consent is separate and is never remembered.
 * Before that yes, vision is on-device only.
 * After that yes, one hybrid call sends the same image. The SDK tries the
 * device first. inferenceSource says whether the cloud was used.
 */
export async function runScanWithConsent(deps: {
  onDevice: () => Promise<ScanAttempt>;
  openHybrid: () => Promise<ScanAttempt>;
  regionAllowed: boolean;
  cloudFallbackEnabled: boolean;
  blockedMessage: string;
  requestConsent: () => Promise<boolean>;
}): Promise<ScanAttempt & { sentToCloud: boolean }> {
  try {
    const onDevice = await deps.onDevice();
    if (formatInferenceSource(onDevice.inferenceSource) === 'IN_CLOUD') {
      throw new CloudNotSentError(UNCONSENTED_CLOUD_MESSAGE);
    }
    return { ...onDevice, sentToCloud: false };
  } catch (error) {
    if (error instanceof CloudNotSentError) {
      throw error;
    }
    if (!deps.regionAllowed || !deps.cloudFallbackEnabled) {
      throw new CloudNotSentError(deps.blockedMessage);
    }
    const allowed = await deps.requestConsent();
    if (!allowed) {
      throw new CloudNotSentError(IMAGE_NOT_SENT_MESSAGE);
    }
    if (selectInferenceMode({
      consentGranted: true,
      regionAllowed: deps.regionAllowed,
      cloudFallbackEnabled: deps.cloudFallbackEnabled,
    }) !== INFERENCE_PREFER_ON_DEVICE) {
      throw new CloudNotSentError(deps.blockedMessage);
    }
    const hybrid = await deps.openHybrid();
    return {
      ...hybrid,
      sentToCloud: formatInferenceSource(hybrid.inferenceSource) === 'IN_CLOUD',
    };
  }
}
