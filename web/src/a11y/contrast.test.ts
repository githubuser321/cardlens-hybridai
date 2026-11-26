import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const stylesheet = readFileSync(fileURLToPath(new URL('../style.css', import.meta.url)), 'utf8');

/** Text pairs used by the UI. Each foreground and background is in style.css. */
const TEXT_PAIRS: readonly [string, string, string][] = [
  ['ink on panel', '#1c1917', '#ffffff'],
  ['muted on paper', '#44403c', '#fff7ed'],
  ['primary label on fill', '#ecfdf5', '#0f766e'],
  ['on-device badge', '#047857', '#ecfdf5'],
  ['cloud badge', '#7c3aed', '#f5f3ff'],
  ['rules badge', '#1c1917', '#ffedd5'],
  ['basic sorting badge', '#92400e', '#fef3c7'],
  ['phone AI badge', '#115e59', '#ccfbf1'],
  ['cloud AI badge', '#5b21b6', '#ede9fe'],
  ['local badge', '#166534', '#dcfce7'],
  ['summary on teal', '#ffffff', '#0f766e'],
  ['summary on violet', '#ffffff', '#5b21b6'],
  ['neutral badge', '#44403c', '#fff7ed'],
  ['down badge', '#b91c1c', '#fef2f2'],
  ['error on panel', '#b91c1c', '#ffffff'],
];

describe('contrast', () => {
  it('keeps text at least WCAG AA against the surfaces that show it', () => {
    for (const [name, foreground, background] of TEXT_PAIRS) {
      expect(stylesheet, name).toContain(foreground);
      expect(stylesheet, name).toContain(background);
      expect(contrastRatio(foreground, background), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the focus ring at least 3:1 against the page', () => {
    expect(stylesheet).toContain('#0d9488');
    expect(contrastRatio('#0d9488', '#fff7ed')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#0d9488', '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#44403c', '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(stylesheet).toContain('prefers-reduced-motion');
  });
});
