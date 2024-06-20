import { createDockerRepository } from './gcp/artifact-registry.ts';
import {
  allowAPIToCallBackgroundProductSearch,
  allowProductSearchToCallBackgroundProductDetail,
  createCloudRunForApi,
  createCloudRunForBackgroundProductDetail,
  createCloudRunForBackgroundProductSearch,
  createCloudRunForWeb,
  onlyAllowServiceToServiceForInvokeAPI,
} from './gcp/cloud-run.ts';
import {
  createProductDetailLowPriorityTaskQueue,
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
const { fullQualifiedQueueName: productDetailLowPriorityQueueName } =
  createProductDetailLowPriorityTaskQueue();

const {
  name: backgroundProductDetailServiceName,
  url: backgroundProductDetailUrl,
} = createCloudRunForBackgroundProductDetail({
  databaseName: databaseName,
});

const {
  name: backgroundProductSearchServiceName,
  serviceAccount: productSearchCloudRunServiceAccount,
  url: backgroundProductSearchUrl,
} = createCloudRunForBackgroundProductSearch({
  databaseName: databaseName,
  productDetailEndpoint: backgroundProductDetailUrl,
  productDetailLowPriorityTaskQueue: productDetailLowPriorityQueueName,
  productDetailTaskQueue: productDetailQueueName,
});
const {
  name: apiServiceName,
  serviceAccount: apiCloudRunServiceAccount,
  url: apiUrl,
} = createCloudRunForApi({
  databaseName: databaseName,
  productSearchEndpoint: backgroundProductSearchUrl,
  productSearchTaskQueue: productSearchQueueName,
});

allowAPIToCallBackgroundProductSearch({
  apiCloudRunServiceAccount: apiCloudRunServiceAccount,
  backgroundProductSearchCloudRunServiceName:
    backgroundProductSearchServiceName,
});
allowProductSearchToCallBackgroundProductDetail({
  backgroundProductDetailCloudRunServiceName:
    backgroundProductDetailServiceName,
  productSearchCloudRunServiceAccount: productSearchCloudRunServiceAccount,
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
