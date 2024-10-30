#!/usr/bin/env bash

set -ex

apt-get update
apt-get install -y curl python3-pip
pip3 install -U pdm
IS_DEV=${1:--dev}
if [ "$IS_DEV" == "--dev" ]; then
  pdm install -G llama.cpp
elif [ "$IS_DEV" == "--prod" ]; then
  pdm install --prod -G llama.cpp
else
  echo "Invalid argument: $IS_DEV"
  exit 1
fi
