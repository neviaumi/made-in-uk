#!/bin/sh

set -ex
SCRIPT_LOCATION=$(dirname $(pwd)/${BASH_SOURCE[0]})
WORK_SPACE_ROOT=$(realpath "$SCRIPT_LOCATION"/../../..)
export APP_ENV=development
PROJECT=made-in-uk
npm run build
STACK=local
STATE_STORE_BUCKET=$(node ./bin/setup-state-store.js made-in-uk-iac-state-store)
pulumi login "gs://$STATE_STORE_BUCKET"
set +e
PULUMI_CONFIG_PASSPHRASE= pulumi stack init organization/$PROJECT/$STACK
set -e
PULUMI_CONFIG_PASSPHRASE= pulumi stack select organization/$PROJECT/$STACK
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:project made-in-uk
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:region europe-west2
PULUMI_CONFIG_PASSPHRASE= pulumi up --yes
PULUMI_CONFIG_PASSPHRASE= pulumi stack output --shell > "$WORK_SPACE_ROOT"/.env
cat "$WORK_SPACE_ROOT"/.env.tmp >> "$WORK_SPACE_ROOT"/.env