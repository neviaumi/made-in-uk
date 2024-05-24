#!/bin/bash

set -ex
PROJECT=made-in-uk
STACK=$1
npm run build
STATE_STORE_BUCKET=$(node ./bin/setup-state-store.js made-in-uk-iac-state-store)
pulumi login "gs://$STATE_STORE_BUCKET"

set +e
PULUMI_CONFIG_PASSPHRASE= pulumi stack init organization/$PROJECT/$STACK
set -e
PULUMI_CONFIG_PASSPHRASE= pulumi stack select organization/$PROJECT/$STACK
PULUMI_CONFIG_PASSPHRASE= pulumi down --yes
PULUMI_CONFIG_PASSPHRASE= pulumi config set app:web-image us-docker.pkg.dev/cloudrun/container/hello
PULUMI_CONFIG_PASSPHRASE= pulumi config set app:api-image us-docker.pkg.dev/cloudrun/container/hello