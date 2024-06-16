#!/usr/bin/env bash

set -ex
BG_PRODUCT_DETAIL_PORT="${PORT:-$BG_PRODUCT_DETAIL_PORT}"
curl --fail-with-body "http://localhost:${BG_PRODUCT_DETAIL_PORT}/health"