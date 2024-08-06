set -ex

LLM_PORT="${PORT:-$LLM_PORT}"
curl --fail-with-body "http://localhost:${WEB_PORT}/health"