#!/bin/sh

set -ex
npx vite build
npx eslint -c eslint.config.js .
npx tsc
npm run test:ci