import { cloudtasks } from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createProductSearchTaskQueue() {
  const queue = new cloudtasks.Queue(resourceName`product-search`, {
    location: getLocation(),
    rateLimits: {
      maxConcurrentDispatches: 1,
      maxDispatchesPerSecond: 1,
    },
    retryConfig: {
      maxBackoff: '600s',
      minBackoff: '60s',
    },
  });
  return {
    fullQualifiedQueueName: pulumi.interpolate`projects/${queue.project}/locations/${queue.location}/queues/${queue.name}`,
  };
}

export function createProductDetailTaskQueue() {
  const queue = new cloudtasks.Queue(resourceName`product-detail`, {
    location: getLocation(),
    rateLimits: {
      maxConcurrentDispatches: 4,
      maxDispatchesPerSecond: 8,
    },
    retryConfig: {
      minBackoff: '30s',
    },
  });
  return {
    fullQualifiedQueueName: pulumi.interpolate`projects/${queue.project}/locations/${queue.location}/queues/${queue.name}`,
  };
}
