#!/usr/bin/env bash

set -ex

IS_DEV=${1:--dev}
if [ "$IS_DEV" == "--dev" ]; then
  pdm install
elif [ "$IS_DEV" == "--prod" ]; then
  pdm install --prod
else
  echo "Invalid argument: $IS_DEV"
  exit 1
fi
