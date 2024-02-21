import busyboxEslintConfig, { globals } from '@busybox/eslint-config';

export default [
  {
    ignores: ['systems/', 'package-lock.json'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...busyboxEslintConfig,
];
