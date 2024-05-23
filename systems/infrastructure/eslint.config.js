import busyboxEslintConfig, { globals } from '@busybox/eslint-config';

export default [
  ...busyboxEslintConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ['package-lock.json', 'bin/', 'Pulumi.*.yml', 'Pulumi.*.yaml'],
  },
  {
    files: ['src/aws-guard/**/*'],
    rules: {
      'n/no-extraneous-require': 'off',
    },
  },
  {
    rules: {
      'no-new': 'off',
    },
  },
];
