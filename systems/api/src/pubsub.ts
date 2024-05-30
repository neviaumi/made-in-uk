import { PubSub } from '@google-cloud/pubsub';

import { APP_ENV, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

export function createPubSubClient(
  ...args: ConstructorParameters<typeof PubSub>
) {
  return new PubSub(...args);
}

export function getProductSearchTopic(pubsub: PubSub) {
  const topicName = config.get('pubsub.topics.productSearch');
  if (!topicName) {
    throw new Error('Product search topic name is not defined');
  }
  return pubsub.topic(topicName);
}
