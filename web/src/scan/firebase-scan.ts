import { type Part } from 'firebase/ai';
import { getCardLensModels, getHybridModels } from '../firebase';
import type { ScanImage } from './image';

export interface ScanModel {
  generateContent(input: { prompt: string; image: ScanImage }): Promise<{ text: string; inferenceSource?: string }>;
}

export function scanParts(prompt: string, image: ScanImage): Part[] {
  return [
    { type: 'text', text: prompt },
    { type: 'inlineData', inlineData: { mimeType: image.mimeType, data: image.base64 } },
  ];
}

/** On-device vision. Does not fall back to the cloud. */
export function firebaseOnDeviceScanModel(): ScanModel {
  return {
    async generateContent(input) {
      const { scan } = getCardLensModels();
      const result = await scan.generateContent(scanParts(input.prompt, input.image));
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    },
  };
}

/** Hybrid vision. Caller must already have image consent. One request, no retry. */
export async function firebaseHybridScanModel(): Promise<ScanModel> {
  const { scan } = await getHybridModels();
  return {
    async generateContent(input) {
      const result = await scan.generateContent(scanParts(input.prompt, input.image));
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    },
  };
}
