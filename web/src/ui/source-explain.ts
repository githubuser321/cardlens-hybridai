import type { CloudGateReason } from '../compliance/cloud-gate';
import type { InferenceSourceTag } from '../inference-source';

export type SortGate = CloudGateReason | 'offline' | 'app-check';

export interface SortContext {
  gate: SortGate;
  preferenceNever: boolean;
  sessionOff: boolean;
  modelUnsupported: boolean;
  declined: boolean;
}

export interface SortExplanation {
  title: string;
  body: string;
  action: 'browsers' | 'settings' | 'retry' | 'sent' | null;
  actionLabel: string | null;
}

const BASIC_TITLE = 'Why basic sorting?';

export function explainSorting(source: InferenceSourceTag | 'LOCAL', context: SortContext): SortExplanation {
  if (source === 'ON_DEVICE') {
    return {
      title: 'How this was sorted',
      body: 'Sorted by AI built into your browser. Nothing left your device.',
      action: null,
      actionLabel: null,
    };
  }
  if (source === 'IN_CLOUD') {
    return {
      title: 'How this was sorted',
      body: 'Sorted by Google\'s Gemini after you agreed. Names, addresses and card numbers were removed first.',
      action: 'sent',
      actionLabel: 'See what was sent',
    };
  }
  if (context.modelUnsupported) {
    return {
      title: BASIC_TITLE,
      body: 'This browser doesn\'t have built-in AI yet, so CardLens sorted your charges with simple keyword rules. Your statement stayed on this device.',
      action: 'browsers',
      actionLabel: 'Which browsers have it?',
    };
  }
  if (context.declined || context.preferenceNever || context.sessionOff || source === 'LOCAL') {
    return {
      title: BASIC_TITLE,
      body: 'You chose to keep analysis on this device, so cloud AI wasn\'t used. Nothing was sent.',
      action: 'settings',
      actionLabel: 'Change in Settings',
    };
  }
  if (context.gate === 'restricted-locale' || context.gate === 'restricted-timezone' || context.gate === 'fetch-failed-restricted') {
    return {
      title: BASIC_TITLE,
      body: 'Cloud AI isn\'t offered in your region yet, so we used basic sorting on this device. Nothing was sent.',
      action: null,
      actionLabel: null,
    };
  }
  if (context.gate === 'offline') {
    return {
      title: BASIC_TITLE,
      body: 'You\'re offline, so we used basic sorting on this device. Cloud AI needs a connection.',
      action: null,
      actionLabel: null,
    };
  }
  if (
    context.gate === 'app-check'
    || context.gate.startsWith('fetch-failed')
    || context.gate === 'remote-off'
    || context.gate === 'remote-unrecognized'
  ) {
    return {
      title: BASIC_TITLE,
      body: 'Cloud AI isn\'t available right now, so we used basic sorting on this device. Nothing was sent.',
      action: 'retry',
      actionLabel: 'Try again',
    };
  }
  return {
    title: BASIC_TITLE,
    body: 'CardLens used basic sorting on this device. Nothing was sent.',
    action: 'retry',
    actionLabel: 'Try again',
  };
}

export const SOURCE_LABELS = {
  RULES: 'Basic sorting (no AI)',
  ON_DEVICE_MOBILE: 'AI on your phone',
  ON_DEVICE_DESKTOP: 'AI on this device',
  IN_CLOUD: 'Cloud AI (you agreed)',
  LOCAL: 'Nothing left your device',
  UNKNOWN: 'Not sorted yet',
} as const;
