#!/bin/sh

set -ex

npx eslint .
npx tsc
npx vitest run --no-file-parallelism