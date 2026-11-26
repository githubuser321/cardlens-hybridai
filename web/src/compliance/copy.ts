/** Consent copy. Variant B (Gemini free tier / Spark). Not lawyer-reviewed. */
export const CONSENT_TEXT_VERSION = '2026-11-15-free-b';

export const CLOUD_TEXT_TITLE_EN = 'Analyze in the cloud?';

export const CLOUD_TEXT_BODY_EN =
  'This device can\'t finish the analysis on its own. If you agree, CardLens will remove your name, address and card/account numbers, and send the remaining statement text to Google\'s Gemini API to analyze it. Nothing is stored on CardLens servers. On Google\'s free tier, Google may use this text to improve its products and human reviewers may read it.';

export const FREE_TIER_TEXT_SENTENCE_EN =
  'On Google\'s free tier, Google may use this text to improve its products and human reviewers may read it.';

export const CLOUD_TEXT_KEEP_EN = 'Keep it on my device';
export const CLOUD_TEXT_SEND_EN = 'Send redacted text';
export const CLOUD_TEXT_PREVIEW_EN = 'See exactly what will be sent';
export const CLOUD_TEXT_PRIVACY_EN = 'Privacy Policy';

export const CLOUD_IMAGE_TITLE_EN = 'Send this image?';

export const CLOUD_IMAGE_BODY_EN =
  'Images can\'t be fully redacted. The picture may show your name, address, card digits and all transactions. If you continue, the image will be sent to Google\'s Gemini API for analysis. On Google\'s free tier, Google may use this image to improve its products and human reviewers may read it.';

export const CLOUD_IMAGE_CHECK_EN = 'I understand and want to send this image.';
export const CLOUD_IMAGE_CANCEL_EN = 'Cancel';
export const CLOUD_IMAGE_SEND_EN = 'Send image';

export const RECAPTCHA_LINE_EN = 'This site is protected by reCAPTCHA.';
export const RECAPTCHA_MORE_EN = 'Learn how we use it';

export const AI_DISCLAIMER_EN = 'AI-generated – may contain mistakes. Not financial advice.';
export const CHIP_DEVICE_EN = 'Analyzed on your device';
export const CHIP_CLOUD_EN = 'Analyzed in the cloud (redacted)';

export const FIRST_RUN_EN =
  'CardLens analyzes statements on your device. For informational use only – not financial advice. 18+. By continuing you agree to the Terms and acknowledge the Privacy Policy.';
export const FIRST_RUN_CONTINUE_EN = 'Continue';
export const FIRST_RUN_TEXT_VERSION = '2026-11-15';

export type ConsentKind = 'cloud-text' | 'cloud-image';

export function consentBody(kind: ConsentKind): string {
  if (kind === 'cloud-image') {
    return CLOUD_IMAGE_BODY_EN;
  }
  return CLOUD_TEXT_BODY_EN;
}
