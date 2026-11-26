/** A page with almost no text layer is treated as a scan and needs the vision model. */
export function pageNeedsScan(lines: readonly string[]): boolean {
  const text = lines.join('').replace(/\s+/g, '');
  return text.length < 12;
}

export async function collectStatementLines(
  pages: readonly (readonly string[])[],
  transcribePage: (pageNumber: number) => Promise<string[]>,
): Promise<{ pages: string[][]; warnings: string[] }> {
  const result: string[][] = [];
  const warnings: string[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const lines = [...(pages[index] ?? [])];
    if (!pageNeedsScan(lines)) {
      result.push(lines);
      continue;
    }
    try {
      result.push(await transcribePage(index + 1));
    } catch (error) {
      result.push(lines);
      const message = error instanceof Error ? error.message : 'Could not read this scan';
      warnings.push(`Page ${index + 1}: ${message}`);
    }
  }
  return { pages: result, warnings };
}
