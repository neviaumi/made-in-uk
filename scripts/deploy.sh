#!/usr/bin/env bash

set -ex
ENVIRONMENT=$1

if [ -z "$CI" ]; then
  # https://github.com/orgs/community/discussions/26560
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git config user.name "github-actions[bot]"
fi

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
COMMIT_MESSAGE="release v$RELEASE_VERSION [skip ci]"
git switch -c "$RELEASE_BRANCH"
git push --set-upstream origin "$RELEASE_BRANCH"
npx lerna version --message "$COMMIT_MESSAGE" --yes $RELEASE_VERSION
npx lerna exec --stream \
--scope 'infrastructure' \
-- "bash scripts/ci/deploy.sh $ENVIRONMENT"

npx lerna exec --stream \
--scope 'infrastructure' \
-- "bash scripts/ci/export-environment.sh $ENVIRONMENT"

source $WORK_SPACE_ROOT/.env

export API_CLOUD_RUN_SERVICE_NAME=$API_CLOUD_RUN_SERVICE_NAME
export API_DATABASE_ID=$API_DATABASE_ID
export DOCKER_REGISTRY=$DOCKER_REGISTRY
export WEB_API_HOST=$WEB_API_HOST
export WEB_CLOUD_RUN_SERVICE_NAME=$WEB_CLOUD_RUN_SERVICE_NAME

npx lerna exec --stream \
--scope 'api' \
-- "bash scripts/ci/deploy.sh"

npx lerna exec --stream \
--scope 'web' \
-- "bash scripts/ci/deploy.sh"