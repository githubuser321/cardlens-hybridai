import { getCardLensModels, getHybridModels } from '../firebase';
import type { InsightsModel } from '../insights/create-insights';

/** On-device insights. Pass only the redacted aggregate. */
export function firebaseOnDeviceInsightsModel(): InsightsModel {
  return {
    async generateContent(prompt: string) {
      const { redactedAggregates } = getCardLensModels();
      const result = await redactedAggregates.generateContent(prompt);
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    },
  };
}

/** Hybrid insights. Caller must already have consent for this exact aggregate. */
export async function firebaseHybridInsightsModel(): Promise<InsightsModel> {
  const { redactedAggregates } = await getHybridModels();
  return {
    async generateContent(prompt: string) {
      const result = await redactedAggregates.generateContent(prompt);
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    },
  };
}
