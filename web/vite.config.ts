import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { CONTENT_SECURITY_POLICY } from './src/compliance/csp';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function cspPlugin(): Plugin {
  return {
    name: 'cardlens-csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (html.includes('Content-Security-Policy')) {
        return html;
      }
      // frame-ancestors is ignored in a meta policy and Chrome logs an error.
      // firebase.json still sends it as a real response header.
      const metaPolicy = CONTENT_SECURITY_POLICY.replace("frame-ancestors 'none'; ", '');
      const meta = `    <meta http-equiv="Content-Security-Policy" content="${metaPolicy}" />`;
      return html.replace('</head>', `${meta}\n  </head>`);
    },
  };
}

export default defineConfig({
  plugins: [cspPlugin()],
  server: {
    fs: {
      allow: [path.resolve(rootDir, '..')],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 120000,
  },
});
