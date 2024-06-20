#! /usr/bin/env bash

set -ex

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch is $CURRENT_BRANCH"
npx eslint .
if [ ! -z "$CI" ]
then
  npx lerna exec --stream \
  -- "test ! -f  scripts/ci/test.sh || bash \
                                  scripts/ci/test.sh"
fi
