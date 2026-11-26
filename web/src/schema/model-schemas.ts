/** JSON schema for the cloud insights call. Not the shared transaction schema. */
export function buildInsightsResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'insights'],
    properties: {
      summary: { type: 'string' },
      insights: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  };
}

/** JSON schema for scanned-page transcription. Lines go back through the parser. */
export function buildScanLinesResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['lines'],
    properties: {
      lines: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  };
}
