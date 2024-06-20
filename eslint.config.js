import busyboxEslintConfig, { globals } from '@busybox/eslint-config';

export default [
  {
    ignores: ['systems/', 'package-lock.json', 'gha-creds-*.json'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...busyboxEslintConfig,
  {
    files: ['*.md'],
    rules: {
      'markdownlint/md013': 'off',
    },
  },
];
