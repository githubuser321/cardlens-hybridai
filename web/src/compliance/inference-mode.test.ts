import { describe, expect, it } from 'vitest';
import type { CloudGateReason } from './cloud-gate';
import {
  gateAllowsHybrid,
  INFERENCE_ONLY_ON_DEVICE,
  INFERENCE_PREFER_ON_DEVICE,
  selectInferenceMode,
} from './inference-mode';

const REASONS: CloudGateReason[] = [
  'restricted-locale',
  'restricted-timezone',
  'fetch-failed-restricted',
  'remote-off',
  'remote-unrecognized',
  'fetch-failed-no-signal',
  'fetch-failed-open',
  'remote-on',
];

describe('selectInferenceMode', () => {
  it('returns prefer-on-device only when consent, region, and the kill switch all allow cloud', () => {
    const flags = [false, true];
    const seen: string[] = [];
    for (const consentGranted of flags) {
      for (const regionAllowed of flags) {
        for (const cloudFallbackEnabled of flags) {
          const mode = selectInferenceMode({ consentGranted, regionAllowed, cloudFallbackEnabled });
          seen.push(`${consentGranted}/${regionAllowed}/${cloudFallbackEnabled}=${mode}`);
          const hybrid = consentGranted && regionAllowed && cloudFallbackEnabled;
          expect(mode).toBe(hybrid ? INFERENCE_PREFER_ON_DEVICE : INFERENCE_ONLY_ON_DEVICE);
        }
      }
    }
    expect(seen).toHaveLength(8);
    expect(seen.filter((row) => row.endsWith(INFERENCE_PREFER_ON_DEVICE))).toEqual([
      'true/true/true=prefer_on_device',
    ]);
  });

  it('maps every Remote Config reason onto those booleans', () => {
    expect(REASONS.map((reason) => [reason, gateAllowsHybrid(reason)])).toEqual([
      ['restricted-locale', { regionAllowed: false, cloudFallbackEnabled: false }],
      ['restricted-timezone', { regionAllowed: false, cloudFallbackEnabled: false }],
      ['fetch-failed-restricted', { regionAllowed: false, cloudFallbackEnabled: false }],
      ['remote-off', { regionAllowed: true, cloudFallbackEnabled: false }],
      ['remote-unrecognized', { regionAllowed: true, cloudFallbackEnabled: false }],
      ['fetch-failed-no-signal', { regionAllowed: true, cloudFallbackEnabled: false }],
      ['fetch-failed-open', { regionAllowed: true, cloudFallbackEnabled: true }],
      ['remote-on', { regionAllowed: true, cloudFallbackEnabled: true }],
    ]);
  });
});
