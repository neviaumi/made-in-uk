import busyboxEslintConfig, { globals } from '@busybox/eslint-config';
import eslintPluginImport from '@busybox/eslint-config/plugins/eslint-plugin-import';

export default [
  ...busyboxEslintConfig,
  {
    ignores: ['package-lock.json', 'build', '.cache', 'public/build'],
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
    files: ['app/entry.server.tsx'],
    rules: {
      'max-params': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['tailwind.config.mjs'],
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
];
