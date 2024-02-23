import { firestore } from '@pulumi/gcp';

import { createDockerRepository } from './gcp/artifactregistry/artifact-registry.ts';
import { createCloudFunctions } from './gcp/cloud-functions/cloud-functions.ts';
import { createSamplePubSubSubscriberCodeArchive } from './gcp/cloud-functions/create-sample-pub-sub-subscriber-code-archive.ts';
import {
  createCloudRunForApi,
  createCloudRunForWeb,
  onlyAllowServiceToServiceForInvokeAPI,
} from './gcp/cloud-run/cloud-run.ts';
import { createApiSampleImage } from './gcp/cloud-run/create-api-sample-image.ts';
import { createWebSampleImage } from './gcp/cloud-run/create-web-sample-image.ts';
import { createCloudStorageForCloudFunction } from './gcp/cloud-storage.ts';
import { createPubSubTopics } from './gcp/pub-sub.ts';
import { getProjectRegion } from './utils/get-project-region.ts';
import { resourceName } from './utils/resourceName.ts';

const { bucketName: cloudStorageFunctionSourceBucket } =
  createCloudStorageForCloudFunction();
const fireStoreDB = new firestore.Database(resourceName`my-database`, {
  locationId: getProjectRegion(),
  type: 'FIRESTORE_NATIVE',
});
const topic = createPubSubTopics();
const samplePubSubArchive = createSamplePubSubSubscriberCodeArchive({
  bucket: cloudStorageFunctionSourceBucket,
});
createCloudFunctions({
  firestore: { id: fireStoreDB.name },
  source: samplePubSubArchive,
  topic: { name: topic.topicId },
});

const { repositoryUrl: dockerRepository } = createDockerRepository();
const { imageId: sampleApiImageId } = createApiSampleImage({
  repositoryUrl: dockerRepository,
});
const { imageId: sampleWebImageId } = createWebSampleImage({
  repositoryUrl: dockerRepository,
});
const { name: serviceName, url: apiUrl } = await createCloudRunForApi({
  databaseName: fireStoreDB.name,
  simpleApiImage: sampleApiImageId,
  topicId: topic.topicId,
});

const { serviceAccount, url: webUrl } = await createCloudRunForWeb({
  apiEndpoint: apiUrl,
  simpleWebImage: sampleWebImageId,
});

onlyAllowServiceToServiceForInvokeAPI({
  apiCloudRunServiceName: serviceName,
  webCloudRunServiceAccount: serviceAccount,
});

export const INFRASTRUCTURE_CLOUD_RUN_SERVICE_ACCOUNT = serviceAccount;
export const API_DATABASE_ID = fireStoreDB.name;
export const WEB_BACKEND_HOST = apiUrl;
export const API_WEB_HOST = webUrl;
export const DOCKER_REGISTRY = dockerRepository;
