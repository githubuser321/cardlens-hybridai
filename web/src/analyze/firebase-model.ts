import { getCardLensModels, getHybridModels } from '../firebase';
import type { MerchantModel } from './categorize';

/** On-device categorization. Pass only a prompt built from redacted merchant strings. */
export function firebaseOnDeviceMerchantModel(): MerchantModel {
  return {
    async generateContent(prompt: string) {
      const { categorization } = getCardLensModels();
      const result = await categorization.generateContent(prompt);
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    },
  };
}

/** Hybrid categorization. Caller must already have consent for this exact prompt. */
export async function firebaseHybridMerchantModel(): Promise<MerchantModel> {
  const { categorization } = await getHybridModels();
  return {
    async generateContent(prompt: string) {
      const result = await categorization.generateContent(prompt);
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    },
  };
}
