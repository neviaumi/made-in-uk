import { PubSub } from '@google-cloud/pubsub';

import { APP_ENV, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

export function pubsubHealthCheck(pubsub: PubSub) {
  return async function healthCheckByGetTopicInfo(): Promise<
    { ok: true } | { error: { code: string; message: string }; ok: false }
  > {
    return await getProductSearchTopic(pubsub)
      .get()
      .then(async ([topic]) => {
        const [topicExists] = await topic.exists();
        if (!topicExists) {
          return {
            error: {
              code: 'ERR_PUBSUB_HEALTH_CHECK_FAILED',
              message: 'Topic does not exist',
            },
            ok: false,
          };
        }
        return {
          ok: true as const,
        };
      })
      .catch(e => {
        return {
          error: {
            code: 'ERR_PUBSUB_HEALTH_CHECK_FAILED',
            message: e.message,
          },
          ok: false,
        };
      });
  };
}

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
