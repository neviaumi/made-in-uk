set -ex

API_PORT="${PORT:-$API_PORT}"
curl "http://localhost:${API_PORT}/healthz"