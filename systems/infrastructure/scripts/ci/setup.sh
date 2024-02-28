#!/bin/sh

set -ex

curl -fsSL https://get.pulumi.com | sh
npm ci
npm run build
STATE_STORE_BUCKET=$(node ./bin/setup-state-store.js made-in-uk-iac-state-store)
pulumi login "gs://$STATE_STORE_BUCKET"