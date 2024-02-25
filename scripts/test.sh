#! /usr/bin/env bash

set -ex

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch is $CURRENT_BRANCH"
npx eslint .
docker compose up -d
export FIRESTORE_EMULATOR_HOST="localhost:8080"
npx lerna exec --stream \
--scope 'api' --scope 'web' \
-- "test ! -f  scripts/ci/test.sh || bash \
                                scripts/ci/test.sh"