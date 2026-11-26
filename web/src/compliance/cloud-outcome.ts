/** How a model attempt ended, from the reader's point of view. */
export type CallOutcome = 'ok' | 'declined' | 'failed' | 'blocked';

export const CLOUD_FAILED_ALERT =
  "Cloud analysis isn't available right now, so we used on-device rules. Nothing from your statement was sent.";

/** Keep statement text out of a disclosure, and cap runaway error strings. */
export function safeTechnicalDetail(raw: string, secret = ''): string {
  if (secret && raw.includes(secret)) {
    return 'The model call failed. The error text was hidden so it could not echo your statement.';
  }
  if (raw.length > 500) {
    return `${raw.slice(0, 500)}…`;
  }
  return raw;
}
