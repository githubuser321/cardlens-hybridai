import { pathToFileURL } from 'node:url';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { textItemsToLines, type PdfTextItem } from './text-items-to-lines';

const legacyRoot = new URL('../../node_modules/pdfjs-dist/legacy/build/', import.meta.url);
const standardFonts = new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url);

GlobalWorkerOptions.workerSrc = pathToFileURL(
  fileUrl(new URL('pdf.worker.min.mjs', legacyRoot)),
).href;

/** Two-page Helvetica PDF: groceries/fuel on page 1, a subscription on page 2. */
const SAMPLE_PDF_BASE64 =
  'JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxNTMKPj4Kc3RyZWFtCnicdc09CgJBDAXgPqeYWhAzycv8gFjsuouFjTAXEFlF0WJFPL+zYmOxJOS9IvCN1BRiN83zQqvdcH8Pr+vpuIycExLHlJ2HK2eSevfkv6/eRanLrjxobREJPVqYMEJtPWBa+xbeBA3MIKxQkU69po0rNyoL6godaJzzc4SEJBbSnB/yz9fqW/XbavbIU6qpVY2V/7QPyH00GAplbmRzdHJlYW0KZW5kb2JqCgo4IDAgb2JqCjw8Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9MZW5ndGggMTExCj4+CnN0cmVhbQp4nB2KMQoCQRAE837FxII4O9tz7oIYqCsGJsJ8QOSUEw0Uufd7ShUV1QubgMqP9w2LQ/8Y+89wOc9NVYt6LZ0kSlxhU49I/zXJ0iZV4okVG93JjltWL9aYuefONKfs1nLNdS1xR8zQAid8AdWrGQkKZW5kc3RyZWFtCmVuZG9iagoKOSAwIG9iago8PAovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvT2JqU3RtCi9OIDYKL0ZpcnN0IDMyCi9MZW5ndGggNDA1Cj4+CnN0cmVhbQp4nNVTS2vcMBC+61fMsT00GsuWLJdlYR92AyE07BZaWnrw2mJxWaRia0Py7zNj72bJIeQQKBQzlmbmm5f9TQIICjRCCjaDDHRqQYNRCDnYNIXZTMhvj38dyLt67wYhb7p2gF+EQdgQht+/hVyFo4+gxHwuLhGrOtaHsBdTKCQMPiPu+tAeG9fDrCqrCjFHRJORGES1pnNFUpAo0smnLN1J8uwkZMtTxHRBvmoSk08x7B+x+hRf0klYw5j1hM3spD/X5VrllEO91U8xF/I2tOs6Oviw/qxQmSRJlEKt0+TnR/ocvatj+H+HG/vvgn91whf/uQo+Crk97uKosjERclkPjj0gr93h3sWuqYUsfRPazu9Bfu/8wg/d2fAyIxOGadM7ip94IzduCMe+ISIxbszMl+fkn3IsLE2e24J4PIZcfEWeKWOVNvbko3Lyx9fdH9eMaVgtH+KXbeSJJwPbbl3b1cvwQIxHenShr5SlTUmuqArxfuF9iLwP4w74SP2yZk578f6hmB4WdWHNP2ncXhp/Ap/vAaEKZW5kc3RyZWFtCmVuZG9iagoKMTAgMCBvYmoKPDwKL1NpemUgMTEKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL1hSZWYKL0xlbmd0aCA0NwovVyBbIDEgMiAyIF0KL0luZGV4IFsgMCAxMSBdCj4+CnN0cmVhbQp4nCXJoREAIAwEwfsEBI7+PYbyaCDwg1mzQFUwwMiESdPE/NHFAWk/csEFhqMEqQplbmRzdHJlYW0KZW5kb2JqCgpzdGFydHhyZWYKOTMzCiUlRU9G';

describe('pdf.js text items', () => {
  it('turns a real PDF into one line array per page', async () => {
    const data = Uint8Array.from(Buffer.from(SAMPLE_PDF_BASE64, 'base64'));
    const task = getDocument({
      data,
      standardFontDataUrl: pathToFileURL(fileUrl(standardFonts)).href,
    });
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
            transform: item.transform.flatMap((value) => (typeof value === 'number' ? [value] : [])),
          });
        }
        pages.push(textItemsToLines(items));
      }
      expect(pages).toEqual([
        ['WHOLE FOODS MARKET 42.18', 'SHELL OIL 55.00'],
        ['NETFLIX.COM 15.99'],
      ]);
    } finally {
      await task.destroy();
    }
  });
});

function fileUrl(url: URL): string {
  return url.pathname;
}
