#!/bin/bash

set -ex
PROJECT=made-in-uk
TYPE=$1
STACK=$2
VERSION=$3

if [ "$TYPE" != "container" ] || [ "$TYPE" != "infrastructure" ]; then
  echo "Invalid argument: $TYPE"
  exit 1
fi

npm run build
STATE_STORE_BUCKET=$(node ./bin/setup-state-store.js made-in-uk-iac-state-store)
pulumi login "gs://$STATE_STORE_BUCKET"
set +e
PULUMI_CONFIG_PASSPHRASE= pulumi stack init organization/$PROJECT/$STACK
set -e
PULUMI_CONFIG_PASSPHRASE= pulumi stack select organization/$PROJECT/$STACK
#PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:credentials $GOOGLE_APPLICATION_CREDENTIALS
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:project made-in-uk
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:region europe-west2
gcloud auth configure-docker europe-west2-docker.pkg.dev

if [ "$TYPE" == "container" ]; then
  DOCKER_REGISTRY=$(PULUMI_CONFIG_PASSPHRASE= pulumi stack output DOCKER_REGISTRY)
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:web-image "$DOCKER_REGISTRY/web:$VERSION"
  PULUMI_CONFIG_PASSPHRASE= pulumi config set app:api-image "$DOCKER_REGISTRY/api:$VERSION"
fi

PULUMI_CONFIG_PASSPHRASE= pulumi up --yes




