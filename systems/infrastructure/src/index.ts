import pulumi from '@pulumi/pulumi';

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
import {
  createProductDetailCronJob,
  createProductSearchCronJob,
} from './gcp/cloud-scheduler.ts';
import {
  createProductDetailMainTaskQueue,
  createProductDetailTaskQueue,
  createProductSearchMainTaskQueue,
  createProductSearchTaskQueue,
} from './gcp/cloud-tasks.ts';
import { createFireStoreDB } from './gcp/fire-store.ts';
import { PRODUCT_SOURCE } from './types.ts';

const { name: databaseName } = createFireStoreDB();
const { repositoryUrl: dockerRepository } = createDockerRepository();
const { fullQualifiedQueueName: productSearchMainQueueName } =
  createProductSearchMainTaskQueue();
const { fullQualifiedQueueName: productDetailMainQueueName } =
  createProductDetailMainTaskQueue();
const productSearchSubTaskQueues = (
  [PRODUCT_SOURCE.SAINSBURY, PRODUCT_SOURCE.OCADO] as const
).map(source => {
  return [source, createProductSearchTaskQueue(source)] as const;
});
const productDetailSubTaskQueues = Object.values(PRODUCT_SOURCE).map(
  source => [source, createProductDetailTaskQueue(source)] as const,
);

const { name: llmServiceName, url: llmUrl } = createCloudRunForLLM({
  databaseName: databaseName,
});

const {
  name: backgroundProductDetailServiceName,
  serviceAccount: backgroundProductDetailServiceAccount,
  url: backgroundProductDetailUrl,
} = createCloudRunForBackgroundProductDetail({
  databaseName: databaseName,
  llmEndpoint: llmUrl,
  subTaskQueues: Object.fromEntries(
    productDetailSubTaskQueues.map(
      ([source, { fullQualifiedQueueName }]) =>
        [source, fullQualifiedQueueName] as const,
    ),
  ) as { [key in PRODUCT_SOURCE]: pulumi.Output<string> },
});

const {
  name: backgroundProductSearchServiceName,
  serviceAccount: productSearchCloudRunServiceAccount,
  url: backgroundProductSearchUrl,
} = createCloudRunForBackgroundProductSearch({
  databaseName: databaseName,
  productDetailEndpoint: backgroundProductDetailUrl,
  productDetailTaskQueue: productDetailMainQueueName,
  subTaskQueues: Object.fromEntries(
    productSearchSubTaskQueues.map(
      ([source, { fullQualifiedQueueName }]) =>
        [source, fullQualifiedQueueName] as const,
    ),
  ) as Record<
    PRODUCT_SOURCE.SAINSBURY | PRODUCT_SOURCE.OCADO,
    pulumi.Output<string>
  >,
});
const {
  name: apiServiceName,
  serviceAccount: apiCloudRunServiceAccount,
  url: apiUrl,
} = createCloudRunForApi({
  databaseName: databaseName,
  productDetailEndpoint: backgroundProductDetailUrl,
  productDetailTaskQueue: productDetailMainQueueName,
  productSearchEndpoint: backgroundProductSearchUrl,
  productSearchTaskQueue: productSearchMainQueueName,
});

createProductSearchCronJob({
  productSearchEndpoint: backgroundProductSearchUrl,
  serviceAccountEmail: productSearchCloudRunServiceAccount,
});

createProductDetailCronJob({
  productDetailEndpoint: backgroundProductDetailUrl,
  serviceAccountEmail: backgroundProductDetailServiceAccount,
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
