#!/usr/bin/env bash

set -ex
API_PORT="${PORT:-$API_PORT}"
curl --fail-with-body "http://localhost:${API_PORT}/health"