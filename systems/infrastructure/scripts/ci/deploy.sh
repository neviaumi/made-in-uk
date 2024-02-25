#!/bin/bash

set -ex
PROJECT=made-in-uk
STACK=$1



npm run build
STATE_STORE_BUCKET=$(node ./bin/setup-state-store.js made-in-uk-iac-state-store)
pulumi login "gs://$STATE_STORE_BUCKET"
pulumi config set gcp:region <value>
set +e
PULUMI_CONFIG_PASSPHRASE= pulumi stack init organization/$PROJECT/$STACK
set -e
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:project made-in-uk
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:region europe-west2
PULUMI_CONFIG_PASSPHRASE= pulumi stack select organization/$PROJECT/$STACK
PULUMI_CONFIG_PASSPHRASE= pulumi up --yes
