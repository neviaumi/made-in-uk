#!/usr/bin/env bash

set +ex
API_PORT="${PORT:-$API_PORT}"
API_PORT=$API_PORT node ./dist/main.js