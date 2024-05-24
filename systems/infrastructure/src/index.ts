import { createDockerRepository } from './gcp/artifactregistry/artifact-registry.ts';
import {
  createCloudRunForApi,
  createCloudRunForWeb,
  onlyAllowServiceToServiceForInvokeAPI,
} from './gcp/cloud-run/cloud-run.ts';
import { createFireStoreDB } from './gcp/fire-store.ts';
import { createPubSubTopics } from './gcp/pub-sub.ts';

const { name: databaseName } = createFireStoreDB();
const topic = createPubSubTopics();
const { repositoryUrl: dockerRepository } = createDockerRepository();

const { name: apiServiceName, url: apiUrl } = await createCloudRunForApi({
  databaseName: databaseName,
});

const {
  name: webServiceName,
  serviceAccount,
  url: webUrl,
} = await createCloudRunForWeb({
  apiEndpoint: apiUrl,
});

onlyAllowServiceToServiceForInvokeAPI({
  apiCloudRunServiceName: apiServiceName,
  webCloudRunServiceAccount: serviceAccount,
});

export const DATABASE_ID = databaseName;
export const API_CLOUD_RUN_SERVICE_NAME = apiServiceName;
export const API_HOST = apiUrl;
export const WEB_CLOUD_RUN_SERVICE_NAME = webServiceName;
export const WEB_HOST = webUrl;
export const DOCKER_REGISTRY = dockerRepository;
export const TOPIC_ID = topic.topicId;
