#!/bin/sh

set -e
pip install -U pdm
PDM_CHECK_UPDATE=false pdm install --check --prod --no-editable
