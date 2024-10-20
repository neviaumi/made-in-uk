#!/usr/bin/env bash

set -e

IS_DEV=${1:---dev}
apk --no-cache add curl

if [ "$IS_DEV" == "--dev" ]; then
  npm ci --ignore-scripts
elif [ "$IS_DEV" == "--prod" ]; then
  npm ci --ignore-scripts --omit=dev
else
  echo "Invalid argument: $IS_DEV"
  exit 1
fi
