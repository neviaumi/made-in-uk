#!/use/bin bash

set -ex
SCRIPT_LOCATION=$(dirname $(pwd)/${BASH_SOURCE[0]})
APP_ROOT=$(realpath "$SCRIPT_LOCATION"/../../)
DOCKER_REGISTRY=${DOCKER_REGISTRY}
API_CLOUD_RUN_SERVICE_NAME=${API_CLOUD_RUN_SERVICE_NAME}

tag=$(cat $APP_ROOT/package.json | jq -r '.version')
docker build -t "${DOCKER_REGISTRY}/api:latest" -t "${DOCKER_REGISTRY}/api:$tag" -f ./Dockerfile .
docker push "$DOCKER_REGISTRY/api:latest"
docker push "$DOCKER_REGISTRY/api:$tag"
gcloud run deploy $API_CLOUD_RUN_SERVICE_NAME --image "$DOCKER_REGISTRY/api:$tag"
