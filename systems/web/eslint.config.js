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

function withOverride(override) {
  return config => {
    return Object.assign(config, {
      rules: Object.assign(config.rules ?? {}, override.rules ?? {}),
    });
  };
}

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
  useESModuleEslintConfig(),
  withOverride({
    rules: {
      'import/prefer-default-export': 'off',
      'react-refresh/only-export-components': 'off',
    },
  })(useReactEslintConfig()),
  withOverride({
    rules: {
      'perfectionist/sort-imports': 'off',
    },
  })(useCodeSortingEslintConfig()),
  useTypescriptEslintConfig(),
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
];
