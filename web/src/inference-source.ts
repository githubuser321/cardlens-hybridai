/** SDK `InferenceSource` values. Compared as strings so tests do not load Firebase. */
const ON_DEVICE_VALUE = 'on_device';
const IN_CLOUD_VALUE = 'in_cloud';

export type InferenceSourceTag = 'ON_DEVICE' | 'IN_CLOUD' | 'RULES' | 'UNKNOWN';

/** Visible tag for `response.inferenceSource`, plus local keyword rules. */
export function formatInferenceSource(source: string | undefined): InferenceSourceTag {
  if (source === ON_DEVICE_VALUE || source === 'ON_DEVICE') {
    return 'ON_DEVICE';
  }
  if (source === IN_CLOUD_VALUE || source === 'IN_CLOUD') {
    return 'IN_CLOUD';
  }
  if (source === 'rules' || source === 'RULES') {
    return 'RULES';
  }
  return 'UNKNOWN';
}

export function inferenceBadgeLabel(tag: InferenceSourceTag): string {
  switch (tag) {
    case 'ON_DEVICE':
      return 'AI on this device';
    case 'IN_CLOUD':
      return 'Cloud AI (you agreed)';
    case 'RULES':
      return 'Basic sorting (no AI)';
    default:
      return 'Not sorted yet';
  }
}

export function formatModelOutput(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
