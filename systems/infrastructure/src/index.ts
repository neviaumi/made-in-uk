import { createDockerRepository } from './gcp/artifactregistry/artifact-registry.ts';
import {
  allowServiceAccountToCallBackgroundProductDetail,
  allowServiceAccountToCallBackgroundProductSearch,
  createCloudRunForApi,
  createCloudRunForBackgroundProductDetail,
  createCloudRunForBackgroundProductSearch,
  createCloudRunForWeb,
  onlyAllowServiceToServiceForInvokeAPI,
} from './gcp/cloud-run/cloud-run.ts';
import { createFireStoreDB } from './gcp/fire-store.ts';
import {
  createProductDetailServiceAccount,
  createProductSearchServiceAccount,
  createPubSubProductDetailSubscription,
  createPubSubProductDetailTopic,
  createPubSubProductSearchSubscription,
  createPubSubProductSearchTopic,
} from './gcp/pub-sub.ts';

const { name: databaseName } = createFireStoreDB();
const { topicId: productSearchTopic } = createPubSubProductSearchTopic();
const { topicId: productDetailTopic } = createPubSubProductDetailTopic();
const { email: productSearchServiceAccountEmail } =
  createProductSearchServiceAccount();
const { email: productDetailServiceAccountEmail } =
  createProductDetailServiceAccount();
const { repositoryUrl: dockerRepository } = createDockerRepository();

const { name: apiServiceName, url: apiUrl } = await createCloudRunForApi({
  databaseName: databaseName,
  projectSearchTopicId: productSearchTopic,
});
const { url: productSearchUrl } =
  await createCloudRunForBackgroundProductSearch({
    databaseName: databaseName,
    projectDetailTopicId: productDetailTopic,
  });
const { url: productDetailUrl } =
  await createCloudRunForBackgroundProductDetail({
    databaseName: databaseName,
  });
allowServiceAccountToCallBackgroundProductDetail({
  backgroundProductDetailCloudRunServiceName: productDetailUrl,
  serviceAccountEmail: productDetailServiceAccountEmail,
});
allowServiceAccountToCallBackgroundProductSearch({
  backgroundProductSearchCloudRunServiceName: productSearchUrl,
  serviceAccountEmail: productSearchServiceAccountEmail,
});
createPubSubProductSearchSubscription({
  backgroundProductSearchEndpoint: productSearchUrl,
  productSearchServiceAccountEmail,
  productSearchTopicId: productSearchTopic,
});
createPubSubProductDetailSubscription({
  backgroundProductDetailEndpoint: productDetailUrl,
  productDetailServiceAccountEmail,
  productDetailTopicId: productDetailTopic,
});

const { serviceAccount, url: webUrl } = await createCloudRunForWeb({
  apiEndpoint: apiUrl,
});

onlyAllowServiceToServiceForInvokeAPI({
  apiCloudRunServiceName: apiServiceName,
  webCloudRunServiceAccount: serviceAccount,
});

export const WEB_HOST = webUrl;
export const DOCKER_REGISTRY = dockerRepository;
