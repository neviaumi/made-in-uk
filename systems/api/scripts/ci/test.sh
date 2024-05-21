#!/bin/sh

set -ex
npm run build
npx eslint -c eslint.config.js .
npx tsc
npm run test:ci