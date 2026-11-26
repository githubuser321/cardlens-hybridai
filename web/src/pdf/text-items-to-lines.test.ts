import { describe, expect, it } from 'vitest';
import { textItemsToLines, type PdfTextItem } from './text-items-to-lines';

describe('textItemsToLines', () => {
  it('joins items on the same y and splits on hasEOL', () => {
    const items: PdfTextItem[] = [
      { str: 'WHOLE FOODS', transform: [1, 0, 0, 1, 40, 700], hasEOL: false },
      { str: ' 42.18', transform: [1, 0, 0, 1, 140, 700], hasEOL: true },
      { str: 'SHELL', transform: [1, 0, 0, 1, 40, 680], hasEOL: true },
    ];
    expect(textItemsToLines(items)).toEqual(['WHOLE FOODS 42.18', 'SHELL']);
  });

  it('starts a new line when y moves past the tolerance', () => {
    const items: PdfTextItem[] = [
      { str: 'A', transform: [1, 0, 0, 1, 10, 700] },
      { str: 'B', transform: [1, 0, 0, 1, 20, 699] },
      { str: 'C', transform: [1, 0, 0, 1, 10, 690] },
    ];
    expect(textItemsToLines(items)).toEqual(['AB', 'C']);
  });

  it('drops blank lines and ignores items without text', () => {
    const items: PdfTextItem[] = [
      { str: '   ', hasEOL: true },
      { str: '', transform: [1, 0, 0, 1, 0, 100] },
      { str: 'FEE', hasEOL: true },
    ];
    expect(textItemsToLines(items)).toEqual(['FEE']);
  });
});
