#!/bin/sh

set -ex
npx vite build
npx eslint -c eslint.config.js .
npx tsc
export FIRESTORE_EMULATOR_HOST=unused
export BG_PRODUCT_SEARCH_PRODUCT_DETAIL_LOW_PRIORITY_QUEUE=unused
export BG_PRODUCT_SEARCH_PRODUCT_DETAIL_QUEUE=unused
export CLOUD_TASKS_EMULATOR_HOST=unused
export BG_PRODUCT_SEARCH_PRODUCT_DETAIL_ENDPOINT=unused
BG_PRODUCT_SEARCH_ENV=test npx vitest run --no-file-parallelism --passWithNoTests