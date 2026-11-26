import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { textItemsToLines, type PdfTextItem } from './text-items-to-lines';

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extract text from a PDF file in the browser.
 * Returns one array of lines per page. Nothing is uploaded.
 */
export async function extractPdfLines(file: File): Promise<string[][]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data });
  try {
    const pdf = await task.promise;
    const pages: string[][] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item)) {
          continue;
        }
        items.push({
          str: item.str,
          hasEOL: item.hasEOL,
          transform: numericTransform(item.transform),
        });
      }
      pages.push(textItemsToLines(items));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

function numericTransform(transform: readonly unknown[]): number[] | undefined {
  const numbers: number[] = [];
  for (const value of transform) {
    if (typeof value !== 'number') {
      return undefined;
    }
    numbers.push(value);
  }
  return numbers;
}
