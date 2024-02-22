#!/bin/sh

set -ex

npx eslint .
npx tsc
npm run build
PROJECT=made-in-uk
STACK=preview
set +e
PULUMI_CONFIG_PASSPHRASE= pulumi stack init organization/$PROJECT/$STACK
set -e
PULUMI_CONFIG_PASSPHRASE= pulumi stack select organization/$PROJECT/$STACK
PULUMI_CONFIG_PASSPHRASE= pulumi preview
