import { PubSub } from '@google-cloud/pubsub';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger, type Logger } from '@/logging/logger.ts';

const config = loadConfig(APP_ENV);
const defaultLogger = createLogger(APP_ENV);

export function createPubSubClient(
  ...args: ConstructorParameters<typeof PubSub>
) {
  return new PubSub(...args);
}

export function getProductSearchTopic(
  pubsub: PubSub,
  options?: { logger?: Logger },
) {
  const topicName = config.get('pubsub.topics.productSearch');
  const logger = options?.logger ?? defaultLogger;
  if (!topicName) {
    throw new Error('Product search topic name is not defined');
  }
  logger.info(`Getting product search topic: ${topicName}`);
  return pubsub.topic(topicName);
}
