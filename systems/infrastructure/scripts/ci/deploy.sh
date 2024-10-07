#!/bin/bash

set -ex
PROJECT=made-in-uk
STACK=$1
VERSION=$2

npm run build
STATE_STORE_BUCKET=$(node ./bin/setup-state-store.js made-in-uk-iac-state-store)
pulumi login "gs://$STATE_STORE_BUCKET"
set +e
PULUMI_CONFIG_PASSPHRASE= pulumi stack init organization/$PROJECT/$STACK
set -e
PULUMI_CONFIG_PASSPHRASE= pulumi stack select organization/$PROJECT/$STACK
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:project made-in-uk
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:region europe-west2

if [ ! -z "${VERSION}" ];
then
  DOCKER_REGISTRY=$(PULUMI_CONFIG_PASSPHRASE= pulumi stack output DOCKER_REGISTRY)
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:web-image "$DOCKER_REGISTRY/web:$VERSION"
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:api-image "$DOCKER_REGISTRY/api:$VERSION"
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:bg-product-search-image "$DOCKER_REGISTRY/bg-product-search:$VERSION"
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:bg-product-detail-image "$DOCKER_REGISTRY/bg-product-detail:$VERSION"
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:llm-image "$DOCKER_REGISTRY/llm:$VERSION"
fi

PULUMI_CONFIG_PASSPHRASE= pulumi up --yes