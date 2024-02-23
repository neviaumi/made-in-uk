#!/bin/sh

set -ex
npm run build
npx eslint -c eslint.config.mjs .
npx tsc
npm run test:ci