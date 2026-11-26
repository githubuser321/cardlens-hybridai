import type { CloudGateReason } from './cloud-gate';

/** SDK mode names without importing Firebase. `only_in_cloud` is intentionally absent. */
export const INFERENCE_ONLY_ON_DEVICE = 'only_on_device' as const;
export const INFERENCE_PREFER_ON_DEVICE = 'prefer_on_device' as const;

export type SelectedInferenceMode = typeof INFERENCE_ONLY_ON_DEVICE | typeof INFERENCE_PREFER_ON_DEVICE;

/**
 * Hybrid cloud fallback is allowed only when all three are true.
 * Any other combination stays on the device and then keyword rules.
 */
export function selectInferenceMode(input: {
  consentGranted: boolean;
  regionAllowed: boolean;
  cloudFallbackEnabled: boolean;
}): SelectedInferenceMode {
  if (input.consentGranted && input.regionAllowed && input.cloudFallbackEnabled) {
    return INFERENCE_PREFER_ON_DEVICE;
  }
  return INFERENCE_ONLY_ON_DEVICE;
}

/** Split a Remote Config / region decision into the two booleans the mode selector needs. */
export function gateAllowsHybrid(reason: CloudGateReason): {
  regionAllowed: boolean;
  cloudFallbackEnabled: boolean;
} {
  switch (reason) {
    case 'remote-on':
    case 'fetch-failed-open':
      return { regionAllowed: true, cloudFallbackEnabled: true };
    case 'remote-off':
    case 'remote-unrecognized':
    case 'fetch-failed-no-signal':
      return { regionAllowed: true, cloudFallbackEnabled: false };
    case 'restricted-locale':
    case 'restricted-timezone':
    case 'fetch-failed-restricted':
      return { regionAllowed: false, cloudFallbackEnabled: false };
    default:
      return { regionAllowed: false, cloudFallbackEnabled: false };
  }
}
