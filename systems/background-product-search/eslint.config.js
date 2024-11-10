import { useCodeSortingEslintConfig } from '@busybox/eslint-config-code-sorting';
import { useESModuleEslintConfig } from '@busybox/eslint-config-esm';
import {
  useJSONEslintConfig,
  useMarkdownEslintConfig,
  useYamlEslintConfig,
} from '@busybox/eslint-config-text-document';
import { useTypescriptEslintConfig } from '@busybox/eslint-config-typescript';
import globals from 'globals';

import pkgJson from './package.json' with { type: 'json' };

export default [
  {
    ignores: ['package-lock.json', 'dist/', 'coverage/'],
    name: pkgJson.name,
  },
  {
    languageOptions: {
      globals: globals.node,
    },
    name: pkgJson.name,
  },
  useESModuleEslintConfig(),
  useTypescriptEslintConfig(),
  useCodeSortingEslintConfig(),
  useJSONEslintConfig(),
  useYamlEslintConfig(),
  useMarkdownEslintConfig(),
].flat();
