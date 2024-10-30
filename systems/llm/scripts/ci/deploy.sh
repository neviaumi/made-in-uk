#!/use/bin bash

set -ex
SCRIPT_LOCATION=$(dirname $(pwd)/${BASH_SOURCE[0]})
APP_ROOT=$(realpath "$SCRIPT_LOCATION"/../../)
DOCKER_REGISTRY=${DOCKER_REGISTRY}

pdm run huggingface-cli download bartowski/Phi-3.5-mini-instruct-GGUF --include "Phi-3.5-mini-instruct-Q4_K_M.gguf" --local-dir ./.models/phi-3.5

tag=$(cat $APP_ROOT/package.json | jq -r '.version')
docker build -t "${DOCKER_REGISTRY}/llm:$tag" -f ./Dockerfile .
docker push "$DOCKER_REGISTRY/llm:$tag"