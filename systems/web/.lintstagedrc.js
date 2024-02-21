export default {
  '*.{json,js,ts,tsx,yml,yaml,md}': [
    'npx eslint --fix',
    'npx prettier --write',
  ],
};
