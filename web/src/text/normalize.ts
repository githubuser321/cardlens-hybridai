/** Strip bidi marks and collapse whitespace. Keeps display case. */
export function normalizeLine(line: string): string {
  return line
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Case-fold and drop punctuation so keyword and total checks share one form. */
export function normalizeForMatch(value: string): string {
  return normalizeLine(value)
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[-־]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
