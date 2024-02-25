#!/bin/sh

set -ex

curl -fsSL https://get.pulumi.com | sh
npm ci
gcloud auth configure-docker europe-west2-docker.pkg.dev

