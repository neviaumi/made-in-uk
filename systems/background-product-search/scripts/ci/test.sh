#!/bin/sh

set -ex
npx vite build
npx eslint -c eslint.config.js .
npx tsc
BG_PRODUCT_SEARCH_ENV=test npx vitest run --no-file-parallelism --passWithNoTests