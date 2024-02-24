#!/bin/bash

set -ex

#s3_bucket=${WEB_S3_BUCKET}
npm ci --ignore-scripts
npx remix build
#aws s3 cp --recursive dist "s3://$s3_bucket/"