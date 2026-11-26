import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('hosting config', () => {
  it('is static hosting on the Spark plan, with no functions', () => {
    const config = JSON.parse(read('../firebase.json')) as {
      hosting: { public: string };
      functions?: unknown;
    };
    expect(config.hosting.public).toBe('dist');
    expect(config).not.toHaveProperty('functions');
    expect(JSON.stringify(config)).not.toMatch(/AIza|apiKey|secret/i);
    const rc = JSON.parse(read('../.firebaserc')) as { projects: { default: string } };
    expect(rc.projects.default).toBe('cardlens-hybrid');
  });

  it('keeps env example values empty', () => {
    const text = read('../.env.example');
    expect(text).toContain('VITE_APPCHECK_DEBUG_TOKEN=');
    for (const line of text.split('\n')) {
      if (!line.includes('=') || line.trim().startsWith('#')) {
        continue;
      }
      const value = line.slice(line.indexOf('=') + 1).trim();
      expect(value).toBe('');
    }
  });

  it('does not add a second AI SDK next to firebase/ai', () => {
    const model = read('./analyze/firebase-model.ts');
    const firebase = read('./firebase.ts');
    expect(model).toContain("from '../firebase'");
    expect(firebase).toContain("from 'firebase/ai'");
    const insights = read('./analyze/firebase-insights.ts');
    const scan = read('./scan/firebase-scan.ts');
    expect(`${model}\n${firebase}\n${insights}\n${scan}`).not.toMatch(/openai|@google\/generative-ai|anthropic|mlkit/i);
    expect(insights).toContain('getCardLensModels');
    expect(scan).toContain('getCardLensModels');
    expect(scan).toContain('getHybridModels');
    expect(scan).toContain("type: 'inlineData'");
    expect(firebase).toContain('if (import.meta.env.DEV)');
    expect(firebase).toContain('InferenceMode.ONLY_ON_DEVICE');
    expect(firebase).toContain('InferenceMode.PREFER_ON_DEVICE');
    expect(firebase).not.toContain(['ONLY', 'IN', 'CLOUD'].join('_'));
  });
});
