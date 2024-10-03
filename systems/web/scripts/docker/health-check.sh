set -ex

WEB_PORT="${PORT:-$WEB_PORT}"
curl --fail-with-body "http://localhost:${WEB_PORT}/health"