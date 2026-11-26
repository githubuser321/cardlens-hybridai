import { assessRegion, type RegionSignals } from './region';

/**
 * Cloud fallback (text and image) on the Gemini free tier.
 *
 * Enabled only when the browser does not look like the EEA, UK, or Switzerland
 * and Remote Config does not say otherwise. See docs/compliance/E3-audit.md.
 *
 * - A restricted language region or timezone always turns cloud off, even when
 *   the fetched parameter is true. That covers the period before the console
 *   country condition exists.
 * - A fetched value other than true turns cloud off everywhere (kill switch).
 * - A failed fetch with a restricted signal fails closed.
 * - A failed fetch with a clear non-restricted signal fails open for the parameter
 *   only. Consent, App Check, and the network check still apply.
 * - A failed fetch with no language region and no timezone fails closed.
 */
export type CloudGateReason =
  | 'restricted-locale'
  | 'restricted-timezone'
  | 'fetch-failed-restricted'
  | 'remote-off'
  | 'remote-unrecognized'
  | 'fetch-failed-no-signal'
  | 'fetch-failed-open'
  | 'remote-on';

export interface CloudGateDecision {
  enabled: boolean;
  reason: CloudGateReason;
}

export function parseCloudFallback(value: string | null | undefined): boolean | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return null;
}

export function decideCloudFallback(input: {
  remoteFetched: boolean;
  remoteValue: boolean | null;
  signals: RegionSignals;
}): CloudGateDecision {
  const region = assessRegion(input.signals);
  if (region.restricted) {
    if (!input.remoteFetched) {
      return { enabled: false, reason: 'fetch-failed-restricted' };
    }
    return {
      enabled: false,
      reason: region.matchedLocale ? 'restricted-locale' : 'restricted-timezone',
    };
  }
  if (!input.remoteFetched) {
    if (!region.hasSignal) {
      return { enabled: false, reason: 'fetch-failed-no-signal' };
    }
    return { enabled: true, reason: 'fetch-failed-open' };
  }
  if (input.remoteValue === true) {
    return { enabled: true, reason: 'remote-on' };
  }
  if (input.remoteValue === false) {
    return { enabled: false, reason: 'remote-off' };
  }
  return { enabled: false, reason: 'remote-unrecognized' };
}

export function cloudBlockedMessage(reason: CloudGateReason): string {
  switch (reason) {
    case 'restricted-locale':
    case 'restricted-timezone':
      return 'Cloud analysis is off because this browser’s language or timezone looks like the EEA, the UK, or Switzerland. CardLens uses Google’s free Gemini tier, which cannot be offered for cloud analysis there. On-device analysis and keyword rules still run.';
    case 'fetch-failed-restricted':
      return 'Cloud analysis is off. Remote Config could not be loaded, and this browser’s language or timezone looks like the EEA, the UK, or Switzerland. On-device analysis and keyword rules still run.';
    case 'remote-off':
      return 'Cloud analysis is turned off by app configuration (cloud_fallback_enabled). On-device analysis and keyword rules still run.';
    case 'remote-unrecognized':
      return 'Cloud analysis is off because cloud_fallback_enabled was missing or not a clear true/false value. On-device analysis and keyword rules still run.';
    case 'fetch-failed-no-signal':
      return 'Cloud analysis is off because Remote Config could not be loaded and this browser did not provide a language region or timezone. On-device analysis and keyword rules still run.';
    case 'fetch-failed-open':
    case 'remote-on':
      return 'Cloud analysis is available only after you agree. Nothing is sent automatically.';
    default:
      return 'Cloud analysis is off. On-device analysis and keyword rules still run.';
  }
}
