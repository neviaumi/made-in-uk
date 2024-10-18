// Local emulator not playing well on gcloud. have to set it up manually

import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  'cloudTasks.emulatorHost': requireEnv('CLOUD_TASKS_EMULATOR_HOST'),
};

const emulatorHost = new URL(`gcp://${config['cloudTasks.emulatorHost']}`);

const cloudTaskClient = new CloudTasksClient({
  port: Number(emulatorHost.port),
  servicePath: emulatorHost.hostname,
  sslCreds: credentials.createInsecure(),
});
const queueParent = `projects/made-in-uk/locations/localhost`;

async function createQueueIfNotExists(queueName, options) {
  const queue = await cloudTaskClient
    .getQueue({
      name: `${queueParent}/queues/${queueName}`,
    })
    .then(() => ({ exists: true }))
    .catch(err => {
      if (err.code === 5) return { exists: false };
      throw err;
    });
  if (!queue.exists) {
    await cloudTaskClient.createQueue({
      parent: queueParent,
      queue: {
        name: `${queueParent}/queues/${queueName}`,
        rateLimits: options.rateLimits,
        retryConfig: {
          maxAttempts: 16,
          maxBackoff: {
            seconds: 600,
          },
          minBackoff: {
            seconds: 60,
          },
        },
      },
    });
    console.log(`Created queue: ${queueParent}/queues/${queueName}`);
  }
}

await createQueueIfNotExists('product-search', {
  rateLimits: {
    maxConcurrentDispatches: 4,
    maxDispatchesPerSecond: 2,
  },
});
await Promise.all(
  ['OCADO', 'SAINSBURY'].map(source =>
    createQueueIfNotExists(`${source}-product-search`, {
      rateLimits: {
        maxConcurrentDispatches: 2,
        maxDispatchesPerSecond: 1,
      },
    }),
  ),
);
await createQueueIfNotExists('product-details', {
  rateLimits: {
    maxConcurrentDispatches: 32,
    maxDispatchesPerSecond: 16,
  },
});
await Promise.all(
  [
    'OCADO',
    'SAINSBURY',
    'LILYS_KITCHEN',
    'PETS_AT_HOME',
    'VET_SHOP',
    'ZOOPLUS',
  ].map(source =>
    createQueueIfNotExists(`${source}-product-details`, {
      rateLimits: {
        maxConcurrentDispatches: 4,
        maxDispatchesPerSecond: 2,
      },
    }),
  ),
);

console.log('Done');
