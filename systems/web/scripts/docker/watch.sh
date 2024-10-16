#!/usr/bin/env bash

set -ex
WEB_PORT="${PORT:-$WEB_PORT}"
npx remix vite:dev