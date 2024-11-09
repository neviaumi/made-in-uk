import { useCodeSortingEslintConfig } from '@busybox/eslint-config-code-sorting';
import { useESModuleEslintConfig } from '@busybox/eslint-config-esm';
import { useReactEslintConfig } from '@busybox/eslint-config-react';
import { useTailwindCSSEslintConfig } from '@busybox/eslint-config-tailwindcss';
import {
  useJSONEslintConfig,
  useMarkdownEslintConfig,
  useYamlEslintConfig,
} from '@busybox/eslint-config-text-document';
import { useTypescriptEslintConfig } from '@busybox/eslint-config-typescript';
import globals from 'globals';

import pkgjson from './package.json' with { type: 'json' };

export default [
  {
    ignores: ['package-lock.json', 'build', '.cache', 'public/build'],
    name: pkgjson.name,
  },
  {
    languageOptions: {
      globals: globals.browser,
    },
    name: pkgjson.name,
  },
  {
    name: pkgjson.name,
    settings: {
      tailwindcss: {
        config: './tailwind.config.mjs',
      },
    },
  },
  useESModuleEslintConfig({
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  }),
  useReactEslintConfig({
    rules: {
      'import/prefer-default-export': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }),
  useCodeSortingEslintConfig({
    rules: {
      'perfectionist/sort-imports': 'off',
    },
  }),
  useTypescriptEslintConfig({
    rules: {
      '@typescript-eslint/adjacent-overload-signatures': 'off',
      '@typescript-eslint/sort-type-constituents': 'off',
    },
  }),
  useTailwindCSSEslintConfig({
    files: ['app/**/*.ts*(x)'],
  }),
  useYamlEslintConfig(),
  useJSONEslintConfig(),
  useMarkdownEslintConfig(),
  {
    files: ['app/entry.server.tsx'],

    name: pkgjson.name,
    rules: {
      'max-params': 'off',
      'no-console': 'off',
    },
  },
].flat();
