import { HarmBlockThreshold, HarmCategory, type SafetySetting } from 'firebase/ai';

/**
 * Most restrictive Gemini threshold that still returns a normal block.
 * Thresholds that allow every prompt are intentionally unused.
 */
export function conservativeSafetySettings(): SafetySetting[] {
  const threshold = HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
  return [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  ].map((category) => ({ category, threshold }));
}
