/** Sample merchants for the hybrid demo. Not taken from an uploaded statement. */
export const SAMPLE_MERCHANTS = [
  'WHOLE FOODS MARKET',
  'SHELL OIL',
  'NETFLIX.COM',
  'UBER TRIP',
] as const;

export function buildCategorizationPrompt(merchants: readonly string[]): string {
  return [
    'Assign each merchant one category from the response schema enum.',
    'Merchants:',
    ...merchants.map((merchant) => `- ${merchant}`),
  ].join('\n');
}
