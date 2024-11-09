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
    languageOptions: {
      globals: globals.node,
    },
    name: pkgJson.name,
  },
  {
    ignores: ['package-lock.json', 'bin/', 'Pulumi.*.yml', 'Pulumi.*.yaml'],
    name: pkgJson.name,
  },
  {
    name: pkgJson.name,
    rules: {
      'no-new': 'off',
    },
  },
  useESModuleEslintConfig(),
  useTypescriptEslintConfig(),
  useCodeSortingEslintConfig(),
  useJSONEslintConfig(),
  useYamlEslintConfig(),
  useMarkdownEslintConfig(),
  {
    files: ['scripts/**/*'],
    name: pkgJson.name,
    rules: {
      'no-console': 'off',
    },
  },
].flat();
