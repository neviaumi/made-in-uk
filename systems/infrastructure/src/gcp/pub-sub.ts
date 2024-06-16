import { projects, pubsub, serviceaccount } from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

import { getProjectId } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createPubSubProductSearchTopic() {
  const productSearchTopic = new pubsub.Topic(resourceName`product-search`);
  return {
    topicId: productSearchTopic.id,
    topicName: productSearchTopic.name,
    topicUrn: productSearchTopic.urn,
  };
}

export function createProductSearchServiceAccount() {
  const serviceAccount = new serviceaccount.Account(
    resourceName`product-search`,
    {
      accountId: 'product-search',
    },
  );
  new projects.IAMBinding(
    resourceName`allow-product-search-service-account-create-token`,
    {
      members: [serviceAccount.email.apply(email => `serviceAccount:${email}`)],
      project: getProjectId(),
      role: 'roles/iam.serviceAccountTokenCreator',
    },
  );
  return {
    email: serviceAccount.email,
    id: serviceAccount.id,
    name: serviceAccount.name,
  };
}

export function createProductDetailServiceAccount() {
  const serviceAccount = new serviceaccount.Account(
    resourceName`product-detail`,
    {
      accountId: 'product-detail',
    },
  );
  new projects.IAMBinding(
    resourceName`allow-product-detail-service-account-create-token`,
    {
      members: [serviceAccount.email.apply(email => `serviceAccount:${email}`)],
      project: getProjectId(),
      role: 'roles/iam.serviceAccountTokenCreator',
    },
  );
  return {
    email: serviceAccount.email,
    id: serviceAccount.id,
    name: serviceAccount.name,
  };
}

export function createPubSubProductDetailTopic() {
  const productSearchTopic = new pubsub.Topic(resourceName`product-detail`);
  return {
    topicId: productSearchTopic.id,
    topicName: productSearchTopic.name,
    topicUrn: productSearchTopic.urn,
  };
}

export function createPubSubProductSearchSubscription({
  backgroundProductSearchEndpoint,
  productSearchServiceAccountEmail,
  productSearchTopicId,
}: {
  backgroundProductSearchEndpoint: pulumi.Output<string>;
  productSearchServiceAccountEmail: pulumi.Output<string>;
  productSearchTopicId: pulumi.Output<string>;
}) {
  new pubsub.Subscription(resourceName`product-search`, {
    pushConfig: {
      oidcToken: {
        serviceAccountEmail: productSearchServiceAccountEmail,
      },
      pushEndpoint: backgroundProductSearchEndpoint,
    },
    topic: productSearchTopicId,
  });
}

export function createPubSubProductDetailSubscription({
  backgroundProductDetailEndpoint,
  productDetailServiceAccountEmail,
  productDetailTopicId,
}: {
  backgroundProductDetailEndpoint: pulumi.Output<string>;
  productDetailServiceAccountEmail: pulumi.Output<string>;
  productDetailTopicId: pulumi.Output<string>;
}) {
  new pubsub.Subscription(resourceName`product-detail`, {
    pushConfig: {
      oidcToken: {
        serviceAccountEmail: productDetailServiceAccountEmail,
      },
      pushEndpoint: backgroundProductDetailEndpoint,
    },
    topic: productDetailTopicId,
  });
}
