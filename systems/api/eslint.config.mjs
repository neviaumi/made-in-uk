import busyboxEslintConfig, { globals } from '@busybox/eslint-config';
import eslintPluginN from '@busybox/eslint-config/plugins/eslint-plugin-n';

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
    plugins: {
      n: eslintPluginN,
    },
    rules: {
      'import/extensions': 'off',
      // typescript used that for overloading
      'n/no-extraneous-import': [
        'error',
        {
          allowModules: ['express'],
        },
      ],
      // commonjs can't play well with that
      'no-dupe-class-members': 'off',
    },
  },
];
