import {
  CloudNotSentError,
  KEPT_ON_DEVICE_MESSAGE,
  UNCONSENTED_CLOUD_MESSAGE,
} from '../compliance/errors';
import { INFERENCE_PREFER_ON_DEVICE, selectInferenceMode } from '../compliance/inference-mode';
import { formatInferenceSource } from '../inference-source';

export interface TextModel {
  generateContent(prompt: string): Promise<{ text: string; inferenceSource?: string }>;
}

/**
 * Without consent, or when the region or kill switch blocks cloud, the call is
 * on-device only and a failure becomes keyword rules.
 * With consent plus an open region and kill switch, one hybrid call uses the
 * same already-redacted prompt. The SDK tries the device first and may fall
 * back to the cloud. That response's inferenceSource is kept.
 */
export function createGatedModel(deps: {
  onDevice: TextModel;
  openHybrid: () => Promise<TextModel>;
  consentGranted: () => boolean;
  regionAllowed: boolean;
  cloudFallbackEnabled: boolean;
  blockedMessage: string;
  requestConsent: (prompt: string) => Promise<boolean>;
}): TextModel {
  return {
    async generateContent(prompt: string) {
      if (modeFor(deps, deps.consentGranted()) === INFERENCE_PREFER_ON_DEVICE) {
        const hybrid = await deps.openHybrid();
        return hybrid.generateContent(prompt);
      }
      try {
        const onDevice = await deps.onDevice.generateContent(prompt);
        if (formatInferenceSource(onDevice.inferenceSource) === 'IN_CLOUD') {
          throw new CloudNotSentError(UNCONSENTED_CLOUD_MESSAGE);
        }
        return onDevice;
      } catch (error) {
        if (error instanceof CloudNotSentError) {
          throw error;
        }
        if (!deps.regionAllowed || !deps.cloudFallbackEnabled) {
          throw new CloudNotSentError(deps.blockedMessage);
        }
        const allowed = await deps.requestConsent(prompt);
        if (!allowed) {
          throw new CloudNotSentError(KEPT_ON_DEVICE_MESSAGE);
        }
        if (modeFor(deps, true) !== INFERENCE_PREFER_ON_DEVICE) {
          throw new CloudNotSentError(deps.blockedMessage);
        }
        const hybrid = await deps.openHybrid();
        return hybrid.generateContent(prompt);
      }
    },
  };
}

function modeFor(
  deps: { regionAllowed: boolean; cloudFallbackEnabled: boolean },
  consentGranted: boolean,
) {
  return selectInferenceMode({
    consentGranted,
    regionAllowed: deps.regionAllowed,
    cloudFallbackEnabled: deps.cloudFallbackEnabled,
  });
}
