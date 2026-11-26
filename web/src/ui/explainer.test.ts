import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve('src/style.css'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`Missing rule ${selector}`);
  }
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('watch it sort explainer', () => {
  it('keeps the pulse on the caption fade so the pill is not stuck at opacity 0', () => {
    expect(ruleBody('.explainer .scene p')).toMatch(/opacity:\s*0/);
    const pulse = ruleBody('.scene-cta .pulse');
    const animation = pulse.match(/animation:\s*[\s\S]*?;/)?.[0] ?? '';
    expect(animation).toMatch(/cap-cta\s+25s\s+linear\s+1\s+forwards/);
    expect(animation).toContain('cta-pulse');
    expect(animation.indexOf('cap-cta')).toBeLessThan(animation.indexOf('cta-pulse'));
    expect(css).toMatch(/@keyframes cap-cta[\s\S]*82%,\s*100%\s*\{\s*opacity:\s*1/);
    const pulseFrames = css.slice(css.indexOf('@keyframes cta-pulse'), css.indexOf('@keyframes sheet-drop'));
    expect(pulseFrames).not.toMatch(/opacity/);
  });

  it('shows every scene when motion is reduced instead of an empty call to action', () => {
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('animation: none');
    expect(reduced).toMatch(/\.explainer \.scene\s*\{[^}]*position:\s*relative/);
    expect(reduced).toMatch(/\.explainer \.scene\s*\{[^}]*opacity:\s*1/);
    expect(reduced).toMatch(/\.explainer \.scene p,\s*\.scene-cta \.pulse\s*\{[^}]*opacity:\s*1/);
    expect(reduced).not.toMatch(/opacity:\s*0/);
  });
});
