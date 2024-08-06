#!/usr/bin/env bash

set -ex
LLM_PORT="${PORT:-$LLM_PORT}"

pdm run python ./src/llm/main.py