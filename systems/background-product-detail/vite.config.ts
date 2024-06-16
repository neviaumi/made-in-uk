import { dirname, resolve } from 'node:path';

import MagicString from 'magic-string';
import { nodeExternals } from 'rollup-plugin-node-externals';
import { defineConfig, type Plugin, searchForWorkspaceRoot } from 'vite';

function shims(): Plugin {
  return {
    apply: 'build',
    name: 'node-shims',
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('.js')) {
        return null;
      }
      const s = new MagicString(code);
      s.prepend(`
   import __path from 'path';
   import { fileURLToPath as __fileURLToPath } from 'url';
   import { createRequire as __createRequire } from 'module';

   const __getFilename = () => __fileURLToPath(import.meta.url);
   const __getDirname = () => __path.dirname(__getFilename());
   const __dirname = __getDirname();
   const __filename = __getFilename();
   const self = globalThis;
   const require = __createRequire(import.meta.url);
   `);
      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
}

// ESM import.meta.url is not supported in Node.js CommonJS modules
const rootDir = new URL(dirname(import.meta.url)).pathname;

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: [resolve(rootDir, 'src/main.ts')],
      formats: ['es'],
      name: '@made-in-uk/background-product-detail',
    },
    minify: false,
    sourcemap: true,
    target: 'esnext',
  },
  plugins: [shims(), nodeExternals()],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
});
