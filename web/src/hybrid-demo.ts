import { buildCategorizationPrompt, SAMPLE_MERCHANTS } from './categorize-prompt';
import { getCardLensModels } from './firebase';
import { formatInferenceSource, formatModelOutput, type InferenceSourceTag } from './inference-source';
import { CloudNotSentError, UNCONSENTED_CLOUD_MESSAGE } from './compliance/errors';

export interface HybridDemoResult {
  text: string;
  formatted: string;
  /** Raw `response.inferenceSource` from the SDK (`on_device` or `in_cloud`). */
  inferenceSource: string | undefined;
  tag: InferenceSourceTag;
}

/**
 * On-device sample only. The four merchant names are not an uploaded statement.
 * This call uses ONLY_ON_DEVICE and does not fall back to the cloud.
 */
export async function runHybridDemo(): Promise<HybridDemoResult> {
  const { categorization } = getCardLensModels();
  const result = await categorization.generateContent(buildCategorizationPrompt(SAMPLE_MERCHANTS));
  const tag = formatInferenceSource(result.response.inferenceSource);
  if (tag === 'IN_CLOUD') {
    throw new CloudNotSentError(UNCONSENTED_CLOUD_MESSAGE);
  }
  const text = result.response.text();
  return {
    text,
    formatted: formatModelOutput(text),
    inferenceSource: result.response.inferenceSource,
    tag,
  };
}
