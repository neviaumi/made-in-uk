import { createDockerRepository } from './gcp/artifact-registry.ts';
import {
  allowAPIToCallBackgroundProductSearch,
  allowServiceAccountsToCallBackgroundProductDetail,
  allowServiceAccountsToCallLLM,
  createCloudRunForApi,
  createCloudRunForBackgroundProductDetail,
  createCloudRunForBackgroundProductSearch,
  createCloudRunForLLM,
  createCloudRunForWeb,
  onlyAllowServiceToServiceForInvokeAPI,
} from './gcp/cloud-run.ts';
import { createProductSearchCronJob } from './gcp/cloud-scheduler.ts';
import {
  createProductDetailTaskQueue,
  createProductSearchTaskQueue,
} from './gcp/cloud-tasks.ts';
import { createFireStoreDB } from './gcp/fire-store.ts';

const { name: databaseName } = createFireStoreDB();
const { repositoryUrl: dockerRepository } = createDockerRepository();
const { fullQualifiedQueueName: productSearchQueueName } =
  createProductSearchTaskQueue();
const { fullQualifiedQueueName: productDetailQueueName } =
  createProductDetailTaskQueue();

const { name: llmServiceName, url: llmUrl } = createCloudRunForLLM();

const {
  name: backgroundProductDetailServiceName,
  serviceAccount: backgroundProductDetailServiceAccount,
  url: backgroundProductDetailUrl,
} = createCloudRunForBackgroundProductDetail({
  databaseName: databaseName,
  llmEndpoint: llmUrl,
});

const {
  name: backgroundProductSearchServiceName,
  serviceAccount: productSearchCloudRunServiceAccount,
  url: backgroundProductSearchUrl,
} = createCloudRunForBackgroundProductSearch({
  databaseName: databaseName,
  productDetailEndpoint: backgroundProductDetailUrl,
  productDetailTaskQueue: productDetailQueueName,
});
const {
  name: apiServiceName,
  serviceAccount: apiCloudRunServiceAccount,
  url: apiUrl,
} = createCloudRunForApi({
  databaseName: databaseName,
  productDetailEndpoint: backgroundProductDetailUrl,
  productDetailTaskQueue: productDetailQueueName,
  productSearchEndpoint: backgroundProductSearchUrl,
  productSearchTaskQueue: productSearchQueueName,
});

createProductSearchCronJob({
  productSearchEndpoint: backgroundProductSearchUrl,
  serviceAccountEmail: productSearchCloudRunServiceAccount,
});

allowServiceAccountsToCallLLM({
  llmServiceName: llmServiceName,
  serviceAccounts: [backgroundProductDetailServiceAccount],
});

allowAPIToCallBackgroundProductSearch({
  apiCloudRunServiceAccount: apiCloudRunServiceAccount,
  backgroundProductSearchCloudRunServiceName:
    backgroundProductSearchServiceName,
});
allowServiceAccountsToCallBackgroundProductDetail({
  backgroundProductDetailCloudRunServiceName:
    backgroundProductDetailServiceName,
  serviceAccounts: [
    apiCloudRunServiceAccount,
    productSearchCloudRunServiceAccount,
  ],
});

const { serviceAccount: webCloudRunServiceAccount, url: webUrl } =
  createCloudRunForWeb({
    apiEndpoint: apiUrl,
  });

onlyAllowServiceToServiceForInvokeAPI({
  apiCloudRunServiceName: apiServiceName,
  webCloudRunServiceAccount: webCloudRunServiceAccount,
});

export const WEB_HOST = webUrl;
export const DOCKER_REGISTRY = dockerRepository;
// export const LLM_STORAGE_BUCKET = llmStorageBucket;
