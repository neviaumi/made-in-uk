#!/bin/sh

set -ex
npx vite build
npx eslint -c eslint.config.js .
npx tsc
npx vitest run --no-file-parallelism --passWithNoTests