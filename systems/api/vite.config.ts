import { dirname, resolve } from 'node:path';

import { defineConfig, searchForWorkspaceRoot } from 'vite';

// ESM import.meta.url is not supported in Node.js CommonJS modules
const rootDir = new URL(dirname(import.meta.url)).pathname;

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: [resolve(rootDir, 'src/main.ts')],
      formats: ['es'],
      name: '@made-in-uk/api',
    },
    minify: false,
    rollupOptions: {
      external: [
        /^node:/,
        'fs',
        'util',
        'path',
        'os',
        'http',
        'https',
        'zlib',
        'events',
        'crypto',
        'tty',
        'stream',
        'inspector',
        'readline',
        'child_process',
        'constants',
        'module',
        'dns',
        'stream',
        'assert',
        'tls',
        'net',
        'url',
        'tty',
      ],
    },
    sourcemap: true,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  // plugins: [react()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
});
