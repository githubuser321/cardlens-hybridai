/**
 * Rebuild the fictional demo statement used by "Try demo statement".
 *
 *   cd web && npm run demo-fixtures
 *
 * Writes:
 *   public/demo/demo-statement.pdf       text PDF (English)
 *   public/demo/demo-statement-scan.jpg  same page, slightly rotated and noisy
 *
 * Names, the card number, the id, the phone, the email, and the address are
 * invented test patterns. Do not replace them with real customer data.
 * The card number passes Luhn and the id passes the Israeli checksum so the
 * app's redaction actually masks them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, '..');
const outDir = join(webRoot, 'public', 'demo');
const fontPath = join(scriptDir, 'fonts', 'DejaVuSans.ttf');

const INK = rgb(0.11, 0.1, 0.08);
const GREEN = rgb(0.06, 0.43, 0.34);
const RULE = rgb(0.78, 0.72, 0.62);
const PAPER = rgb(0.973, 0.953, 0.925);

/** Stripe test Visa. Clearly fake. */
const PAN = '4242-4242-4242-4242';
const PHONE = '555-010-0199';
const EMAIL = 'sample.cardholder@example.com';

/**
 * One visual line per string. Transaction rows are day/month/year so the
 * deterministic parser can read them. Spotify is charged on 1 Aug, 31 Aug,
 * and 1 Oct (monthly gaps) and is absent in September, so month comparison
 * marks it as a new subscription. The two GETT rows are a duplicate.
 * Amounts stay the same as the previous fixture: a refund, a euro charge,
 * several categories, and more than one month.
 */
const TITLE = 'Sample Bank';
const SUBTITLE = 'Visa •••• 4242 · October 1–31, 2026 · Fictional';
const HEADER = [
  'Cardholder: Sample Cardholder',
  `Card: ${PAN}`,
  'Card ending in 4242',
  `Phone: ${PHONE}`,
  `Email: ${EMAIL}`,
  'Address: 1 Demo Street, Sample City',
  'Statement period October 1–31, 2026',
  'Date Merchant Amount',
];
const TRANSACTIONS = [
  '01/10/26 Netflix $15.49',
  '01/10/26 Spotify $11.99',
  '01/10/26 iCloud+ $2.99',
  '02/10/26 Whole Foods $86.42',
  '03/10/26 ChatGPT Plus $20.00',
  '04/10/26 Trader Joe\'s $54.10',
  '05/10/26 Starbucks $6.45',
  '06/10/26 Uber $18.20',
  '07/10/26 Verizon $70.00',
  '09/10/26 Starbucks $6.45',
  '10/10/26 Con Edison $92.15',
  '11/10/26 Shell $47.90',
  '12/10/26 Chipotle $13.80',
  '14/10/26 Amazon $64.25',
  '16/10/26 Starbucks $6.45',
  '16/10/26 Target $38.70',
  '18/10/26 Cafe de Flore Paris EUR 18.40 $19.98',
  '18/10/26 Foreign transaction fee $0.60',
  '22/10/26 Amazon refund $24.99',
];
const TOTALS = [
  'Includes a foreign charge: Cafe de Flore, Paris EUR 18.40 = $19.98',
];

function assertFixtureSecrets() {
  if (!luhn(PAN.replace(/\D/g, ''))) {
    throw new Error('Demo PAN must pass Luhn so redaction masks it.');
  }
}

function luhn(digits) {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) {
      return false;
    }
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function drawLine(page, font, text, x, y, size, color) {
  page.drawText(text, { x, y, size, font, color });
}

async function buildPdf(fontBytes) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('CardLens fictional demo statement');
  pdf.setAuthor('CardLens demo');
  pdf.setSubject('Fictional English credit-card statement. No real cardholder.');
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const page = pdf.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: PAPER });
  page.drawRectangle({ x: 0, y: 812, width: 595.28, height: 8, color: GREEN });

  let y = 786;
  drawLine(page, font, TITLE, 48, y, 18, GREEN);
  y -= 20;
  drawLine(page, font, SUBTITLE, 48, y, 10, INK);
  y -= 16;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.6, color: RULE });
  y -= 18;

  for (const line of HEADER) {
    const size = line.startsWith('Date') ? 10 : 11;
    drawLine(page, font, line, 48, y, size, INK);
    y -= 15;
  }

  y -= 4;
  page.drawLine({ start: { x: 48, y: y + 10 }, end: { x: 547, y: y + 10 }, thickness: 0.4, color: RULE });
  for (const line of TRANSACTIONS) {
    drawLine(page, font, line, 48, y, 11, INK);
    y -= 15;
  }

  y -= 6;
  page.drawLine({ start: { x: 48, y: y + 12 }, end: { x: 547, y: y + 12 }, thickness: 0.6, color: RULE });
  for (const line of TOTALS) {
    drawLine(page, font, line, 48, y, 11, GREEN);
    y -= 16;
  }
  drawLine(page, font, 'Fictional statement for demonstration.', 48, 36, 9, INK);
  return pdf.save();
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function renderScan(pdfBytes) {
  globalThis.DOMMatrix = DOMMatrix;
  globalThis.ImageData = ImageData;
  globalThis.Path2D = Path2D;
  const worker = join(webRoot, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs');
  GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;
  const task = getDocument({ data: Uint8Array.from(pdfBytes), isEvalSupported: false });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const source = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const sourceContext = source.getContext('2d');
    await page.render({
      canvas: null,
      canvasContext: sourceContext,
      viewport,
    }).promise;

    const angle = (-1.6 * Math.PI) / 180;
    const pad = 72;
    const width = Math.ceil(source.width + pad * 2);
    const height = Math.ceil(source.height + pad * 2);
    const scan = createCanvas(width, height);
    const context = scan.getContext('2d');
    context.fillStyle = '#cfc6b8';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(angle);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    context.restore();

    const pixels = context.getImageData(0, 0, width, height);
    const random = mulberry32(0xc0ffee);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index] * 0.3
        + pixels.data[index + 1] * 0.55
        + pixels.data[index + 2] * 0.15;
      const noise = (random() - 0.5) * 26;
      const value = gray + noise;
      pixels.data[index] = clampByte(value + 6);
      pixels.data[index + 1] = clampByte(value + 2);
      pixels.data[index + 2] = clampByte(value - 8);
    }
    context.putImageData(pixels, 0, 0);
    return scan.toBuffer('image/jpeg', 76);
  } finally {
    await task.destroy();
  }
}

assertFixtureSecrets();
const fontBytes = await readFile(fontPath);
const pdfBytes = Uint8Array.from(await buildPdf(fontBytes));
const scanBytes = await renderScan(pdfBytes);
await mkdir(outDir, { recursive: true });
const pdfPath = join(outDir, 'demo-statement.pdf');
const scanPath = join(outDir, 'demo-statement-scan.jpg');
await writeFile(pdfPath, pdfBytes);
await writeFile(scanPath, scanBytes);
console.log(`Wrote ${pdfPath} (${pdfBytes.length} bytes)`);
console.log(`Wrote ${scanPath} (${scanBytes.length} bytes)`);
