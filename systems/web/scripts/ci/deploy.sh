#!/use/bin bash

set -ex
SCRIPT_LOCATION=$(dirname $(pwd)/${BASH_SOURCE[0]})
APP_ROOT=$(realpath "$SCRIPT_LOCATION"/../../)
DOCKER_REGISTRY=${DOCKER_REGISTRY}
WEB_CLOUD_RUN_SERVICE_NAME=${WEB_CLOUD_RUN_SERVICE_NAME}

tag=$(cat $APP_ROOT/package.json | jq -r '.version')
docker build -t "${DOCKER_REGISTRY}/web:$tag" -f ./Dockerfile .
docker push "$DOCKER_REGISTRY/web:$tag"
gcloud config set run/region europe-west2
gcloud run deploy $WEB_CLOUD_RUN_SERVICE_NAME \
  --image="$DOCKER_REGISTRY/web:$tag" \
  --command="sh" \
  --args='./scripts/docker/start.sh'