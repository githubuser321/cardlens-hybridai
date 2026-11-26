/** A cloud call was refused or discarded. The message must not contain statement text. */
export class CloudNotSentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudNotSentError';
  }
}

/** A message safe to show, with optional technical text for a disclosure. */
export class UserFacingError extends Error {
  readonly detail: string | null;

  constructor(message: string, detail: string | null = null) {
    super(message);
    this.name = 'UserFacingError';
    this.detail = detail;
  }
}

export const KEPT_ON_DEVICE_MESSAGE =
  'Kept on this device. The redacted text was not sent to the cloud.';

export const IMAGE_NOT_SENT_MESSAGE =
  'Kept on this device. The image was not sent.';

export const UNCONSENTED_CLOUD_MESSAGE =
  'A cloud response was discarded because you had not agreed to send it. Nothing further was sent.';
