#!/bin/sh

set -ex
npm run build
npx eslint -c eslint.config.mjs .
npx tsc
export FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run test:ci