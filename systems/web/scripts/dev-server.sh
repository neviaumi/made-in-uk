#!/bin/sh

set -e
SCRIPT_LOCATION=$(dirname "$(pwd)/${BASH_SOURCE[0]}")
APP_ROOT=$(realpath "$SCRIPT_LOCATION/../../..")
echo "APP_ROOT: $APP_ROOT"
source "$APP_ROOT/.env"
WEB_API_HOST=$WEB_API_HOST npm run dev