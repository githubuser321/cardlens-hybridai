import { describe, expect, it } from 'vitest';
import { SAMPLE_MERCHANTS, buildCategorizationPrompt } from './categorize-prompt';
import { formatInferenceSource, formatModelOutput } from './inference-source';

describe('formatInferenceSource', () => {
  it('maps SDK inferenceSource values to visible tags', () => {
    expect(formatInferenceSource('on_device')).toBe('ON_DEVICE');
    expect(formatInferenceSource('in_cloud')).toBe('IN_CLOUD');
    expect(formatInferenceSource('rules')).toBe('RULES');
    expect(formatInferenceSource(undefined)).toBe('UNKNOWN');
  });
});

describe('formatModelOutput', () => {
  it('pretty-prints JSON and leaves other text unchanged', () => {
    expect(formatModelOutput('{"category":"groceries"}')).toBe('{\n  "category": "groceries"\n}');
    expect(formatModelOutput('not json')).toBe('not json');
  });
});

describe('buildCategorizationPrompt', () => {
  it('lists the sample merchants and no statement payload', () => {
    const prompt = buildCategorizationPrompt(SAMPLE_MERCHANTS);
    for (const merchant of SAMPLE_MERCHANTS) {
      expect(prompt).toContain(merchant);
    }
    expect(prompt).not.toContain('amount');
  });
});
