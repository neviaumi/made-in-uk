import { dirname, resolve } from 'node:path';

import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';

const rootDir = new URL(dirname(import.meta.url)).pathname;

export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ['**/*.css'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'app'),
    },
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env['WEB_PORT'] ?? '5173'),
  },
});
