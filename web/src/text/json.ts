/** Pull a JSON value out of a model response, including fenced blocks. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/u, '').trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.search(/[{[]/u);
    const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (start < 0 || end <= start) {
      throw new Error('Model response was not JSON');
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
