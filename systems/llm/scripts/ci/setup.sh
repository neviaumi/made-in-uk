#!/bin/sh

set -e
echo "CI only have NodeJS installed, use docker to do anything you want"
pip install -U pdm
PDM_CHECK_UPDATE=false pdm install --check --no-editable
