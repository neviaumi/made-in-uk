import busyboxEslintConfig, { globals } from '@busybox/eslint-config';
import eslintPluginImport from '@busybox/eslint-config/plugins/eslint-plugin-import';

export default [
  ...busyboxEslintConfig,
  {
    ignores: ['package-lock.json', 'dist'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    settings: {
      tailwindcss: {
        config: './tailwind.config.mjs',
      },
    },
  },
  {
    files: ['./tailwind.config.mjs', './vite.config.ts', './cypress.config.ts'],
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    rules: {
      'max-lines': 'off',
    },
  },
];
