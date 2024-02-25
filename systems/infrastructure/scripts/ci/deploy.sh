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
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:credentials $GOOGLE_APPLICATION_CREDENTIALS
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:project made-in-uk
PULUMI_CONFIG_PASSPHRASE= pulumi config set gcp:region europe-west2
#echo $GOOGLE_APPLICATION_CREDENTIALS
#echo $GCP_SA_KEY > $CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE
#echo $CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE
#gcloud auth login --cred-file=$GOOGLE_APPLICATION_CREDENTIALS
#gcloud config list
gcloud auth configure-docker europe-west2-docker.pkg.dev
PULUMI_CONFIG_PASSPHRASE= pulumi up --yes
