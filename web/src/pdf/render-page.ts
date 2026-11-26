import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { bytesToBase64, type ScanImage } from '../scan/image';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render one PDF page to a PNG. Used only when that page has no text layer. */
export async function renderPdfPageImage(file: File, pageNumber: number): Promise<ScanImage> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data });
  try {
    const pdf = await task.promise;
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`Page ${pageNumber} is not in this PDF.`);
    }
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 1400 / Math.max(base.width, 1));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not draw this PDF page.');
    }
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await canvasToPng(canvas);
    const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    return {
      mimeType: 'image/png',
      base64,
      byteLength: blob.size,
      label: `Page ${pageNumber}`,
    };
  } finally {
    await task.destroy();
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not encode this PDF page.'));
      }
    }, 'image/png');
  });
}
