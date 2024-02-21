export default {
  '*.{ts,js,json}': [
    'npx eslint -c eslint.config.mjs --fix',
    'npx prettier --write',
  ],
};
