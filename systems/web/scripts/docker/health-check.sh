set -ex

WEB_PORT="${PORT:-$WEB_PORT}"
curl "http://localhost:${WEB_PORT}/healthz"