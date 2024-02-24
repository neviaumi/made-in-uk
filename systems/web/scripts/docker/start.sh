#!/usr/bin/env bash

set -ex
export WEB_PORT=$WEB_PORT
PORT=$WEB_PORT npx remix-serve build/index.js