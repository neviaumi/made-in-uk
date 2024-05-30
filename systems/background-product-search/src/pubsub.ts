import { type PublishOptions, PubSub } from '@google-cloud/pubsub';

import { APP_ENV, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

export function createPubSubClient(
  ...args: ConstructorParameters<typeof PubSub>
) {
  return new PubSub(...args);
}

export function getProductDetailTopic(pubsub: PubSub) {
  const topicName = config.get('pubsub.topics.productDetail');
  if (!topicName) {
    throw new Error('Product detail topic name is not defined');
  }
  return function getTopic(options?: PublishOptions) {
    return pubsub.topic(topicName, options);
  };
}
