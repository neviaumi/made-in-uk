// https://cloud.google.com/pubsub/docs/emulator#before-you-begin
// Local emulator not playing well on gcloud. have to set it up manually

import { PubSub } from '@google-cloud/pubsub';

const pubsubLocalEmulatorEnabled = process.env.PUBSUB_EMULATOR_HOST;

if (!pubsubLocalEmulatorEnabled) {
  throw new Error('PUBSUB_EMULATOR_HOST is not set.');
}

const productSearchSubscriptionPushEndpoint =
  process.env.EMULATOR_PRODUCT_SEARCH_ENDPOINT;
const productSearchTopic = process.env.EMULATOR_PRODUCT_SEARCH_TOPIC;

if (!productSearchSubscriptionPushEndpoint || !productSearchTopic) {
  throw new Error(
    'EMULATOR_PRODUCT_SEARCH_ENDPOINT or EMULATOR_PRODUCT_SEARCH_TOPIC is not set.',
  );
}

const { productDetailSubscriptionPushEndpoint, productDetailTopic } = {
  productDetailSubscriptionPushEndpoint:
    process.env.EMULATOR_PRODUCT_DETAIL_ENDPOINT,
  productDetailTopic: process.env.EMULATOR_PRODUCT_DETAIL_TOPIC,
};

if (!productDetailSubscriptionPushEndpoint || !productDetailTopic) {
  throw new Error(
    'EMULATOR_PRODUCT_DETAIL_ENDPOINT or EMULATOR_PRODUCT_DETAIL_TOPIC is not set.',
  );
}
function topicCreator(pubsub) {
  return async function createTopic(topicName) {
    console.log(`Looking for topic: ${topicName}`);
    const topic = pubsub.topic(topicName);
    const [topicExists] = await topic.exists();
    console.log(`Topic ${topicName} exists: ${topicExists}`);
    if (!topicExists) {
      console.log(`Create topic: ${topicName}`);
      await pubsub.createTopic(topicName);
    } else {
      console.log(`Topic ${topicName} already exists`);
    }
    return topic;
  };
}

function subscriptionCreatorOnTopic(topic) {
  return async function createSubscription(subscriptionName, { pushEndpoint }) {
    console.log(`Looking for subscription: ${subscriptionName}`);
    const subscription = topic.subscription(subscriptionName);
    const [subscriptionExists] = await subscription.exists();
    console.log(
      `Subscription ${subscriptionName} exists: ${subscriptionExists}`,
    );
    if (!subscriptionExists) {
      console.log(`Create subscription: ${subscriptionName}`);
      await topic.createSubscription(subscriptionName, {
        pushConfig: {
          pushEndpoint,
        },
      });
    } else {
      console.log(`Subscription ${subscriptionName} already exists`);
    }
    return subscription;
  };
}

const pubsubClient = new PubSub({});
const createTopic = topicCreator(pubsubClient);
await createTopic(productSearchTopic).then(topic =>
  subscriptionCreatorOnTopic(topic)('product-search-subscription', {
    pushEndpoint: productSearchSubscriptionPushEndpoint,
  }),
);

await createTopic(productDetailTopic).then(topic =>
  subscriptionCreatorOnTopic(topic)('product-detail-subscription', {
    pushEndpoint: productDetailSubscriptionPushEndpoint,
  }),
);
