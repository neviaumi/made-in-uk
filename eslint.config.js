import { useCodeSortingEslintConfig } from '@busybox/eslint-config-code-sorting';
import { useESModuleEslintConfig } from '@busybox/eslint-config-esm';
import {
  useJSONEslintConfig,
  useMarkdownEslintConfig,
  useYamlEslintConfig,
} from '@busybox/eslint-config-text-document';
import globals from 'globals';

import pkgjson from './package.json' with { type: 'json' };

export default [
  {
    ignores: ['systems/**/*', 'package-lock.json', 'gha-creds-*.json'],
    name: pkgjson.name,
  },
  {
    languageOptions: {
      globals: globals.node,
    },
    name: pkgjson.name,
  },
  useESModuleEslintConfig(),
  useCodeSortingEslintConfig(),
  useJSONEslintConfig(),
  useMarkdownEslintConfig({
    rules: {
      'markdownlint/md013': 'off',
    },
  }),
  useYamlEslintConfig(),
].flat();
