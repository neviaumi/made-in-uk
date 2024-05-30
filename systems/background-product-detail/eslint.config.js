import busyboxEslintConfig, { globals } from '@busybox/eslint-config';

export default [
  ...busyboxEslintConfig,
  {
    ignores: ['package-lock.json', 'dist/', 'coverage/'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    rules: {
      'no-inner-declarations': 'off',
    },
  },
];
