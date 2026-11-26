/** A PDF.js text item, narrowed to the fields line grouping needs. */
export interface PdfTextItem {
  str: string;
  /** PDF text matrix. Index 5 is the y position in PDF user space. */
  transform?: readonly number[];
  hasEOL?: boolean;
}

const Y_TOLERANCE = 2;

/**
 * Group PDF.js text items into visual lines.
 * Items stay on one line until the y position jumps or the item is marked end-of-line.
 */
export function textItemsToLines(items: readonly PdfTextItem[]): string[] {
  const lines: string[] = [];
  let buffer = '';
  let currentY: number | null = null;

  const flush = (): void => {
    const line = buffer.trim();
    buffer = '';
    if (line.length > 0) {
      lines.push(line);
    }
  };

  for (const item of items) {
    const y = yPosition(item.transform);
    if (y !== null && currentY !== null && Math.abs(y - currentY) > Y_TOLERANCE) {
      flush();
    }
    if (y !== null) {
      currentY = y;
    }
    if (item.str) {
      buffer += item.str;
    }
    if (item.hasEOL) {
      flush();
      currentY = null;
    }
  }

  flush();
  return lines;
}

function yPosition(transform: readonly number[] | undefined): number | null {
  if (!transform || transform.length < 6) {
    return null;
  }
  const y = transform[5];
  return typeof y === 'number' ? y : null;
}
