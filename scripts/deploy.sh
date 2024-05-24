#!/usr/bin/env bash

set -ex
ENVIRONMENT=$1

if [ -z "$CI" ]; then
  echo ""
else
  echo "I am in CI"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git config user.name "github-actions[bot]"
fi

echo "Running in email: $(git config user.email)"
echo "Running in name: $(git config user.name)"

# Disable the commit hook
export HUSKY=0
SCRIPT_LOCATION=$(dirname $(pwd)/${BASH_SOURCE[0]})
WORK_SPACE_ROOT=$(realpath "$SCRIPT_LOCATION"/../)
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" == "main" ]; then
  echo "With major version"
  RELEASE_VERSION=$(date +'%Y.%-m.%-d')
else
  echo "With alpha version"
  RELEASE_VERSION=$(date +"%Y.%-m.%-d-alpha.$(($(date +"%-H") + 1))%M")
fi
export RELEASE_BRANCH="release-$RELEASE_VERSION"
export RELEASE_VERSION=$RELEASE_VERSION
export CURRENT_BRANCH=$CURRENT_BRANCH
COMMIT_MESSAGE="release candidate v$RELEASE_VERSION [skip ci]"
git switch -c "$RELEASE_BRANCH"
git push --set-upstream origin "$RELEASE_BRANCH"
npx lerna version --message "$COMMIT_MESSAGE" --yes $RELEASE_VERSION
npx lerna exec --stream \
--scope 'infrastructure' \
-- "bash scripts/ci/deploy.sh infrastructure $ENVIRONMENT"

npx lerna exec --stream \
--scope 'infrastructure' \
-- "bash scripts/ci/export-environment.sh $ENVIRONMENT"

source $WORK_SPACE_ROOT/.env

export DOCKER_REGISTRY=$DOCKER_REGISTRY

npx lerna exec --stream \
--scope 'api' \
-- "bash scripts/ci/deploy.sh"

npx lerna exec --stream \
--scope 'web' \
-- "bash scripts/ci/deploy.sh"

npx lerna exec --stream \
--scope 'infrastructure' \
-- "bash scripts/ci/deploy.sh container $ENVIRONMENT $RELEASE_VERSION"

npm install
npx lerna exec --stream -- 'npm install'
git add .
git commit -m "release v$RELEASE_VERSION [skip ci]"
git push