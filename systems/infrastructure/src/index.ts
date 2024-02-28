import { createDockerRepository } from './gcp/artifactregistry/artifact-registry.ts';
import {
  createCloudRunForApi,
  createCloudRunForWeb,
  onlyAllowServiceToServiceForInvokeAPI,
} from './gcp/cloud-run/cloud-run.ts';
import { createApiSampleImage } from './gcp/cloud-run/create-api-sample-image.ts';
import { createWebSampleImage } from './gcp/cloud-run/create-web-sample-image.ts';
import { createFireStoreDB } from './gcp/fire-store.ts';
import { createPubSubTopics } from './gcp/pub-sub.ts';

const fireStoreDB = createFireStoreDB();
const topic = createPubSubTopics();
const { repositoryUrl: dockerRepository } = createDockerRepository();
const { imageId: sampleApiImageId } = createApiSampleImage({
  repositoryUrl: dockerRepository,
});
const { imageId: sampleWebImageId } = createWebSampleImage({
  repositoryUrl: dockerRepository,
});
const { name: apiServiceName, url: apiUrl } = await createCloudRunForApi({
  databaseName: fireStoreDB.name,
  simpleApiImage: sampleApiImageId,
});

const {
  name: webServiceName,
  serviceAccount,
  url: webUrl,
} = await createCloudRunForWeb({
  apiEndpoint: apiUrl,
  simpleWebImage: sampleWebImageId,
});

onlyAllowServiceToServiceForInvokeAPI({
  apiCloudRunServiceName: apiServiceName,
  webCloudRunServiceAccount: serviceAccount,
});

export const API_DATABASE_ID = fireStoreDB.name;
export const API_CLOUD_RUN_SERVICE_NAME = apiServiceName;
export const WEB_API_HOST = apiUrl;
export const WEB_CLOUD_RUN_SERVICE_NAME = webServiceName;
export const WEB_HOST = webUrl;
export const DOCKER_REGISTRY = dockerRepository;
export const WORKER_TOPIC_ID = topic.topicId;
