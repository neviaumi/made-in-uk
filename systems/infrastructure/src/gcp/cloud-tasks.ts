import { cloudtasks } from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

import type { PRODUCT_SOURCE } from '../types.ts';
import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createProductSearchMainTaskQueue() {
  const queue = new cloudtasks.Queue(resourceName`product-search`, {
    location: getLocation(),
    rateLimits: {
      maxConcurrentDispatches: 4,
      maxDispatchesPerSecond: 2,
    },
    retryConfig: {
      maxAttempts: 16,
      maxBackoff: '600s',
      minBackoff: '60s',
    },
  });
  return {
    fullQualifiedQueueName: pulumi.interpolate`projects/${queue.project}/locations/${queue.location}/queues/${queue.name}`,
  };
}

export function createProductSearchTaskQueue(
  productSource: PRODUCT_SOURCE.OCADO | PRODUCT_SOURCE.SAINSBURY,
) {
  const queue = new cloudtasks.Queue(
    resourceName`${productSource}-product-search`,
    {
      location: getLocation(),
      rateLimits: {
        maxConcurrentDispatches: 2,
        maxDispatchesPerSecond: 1,
      },
      retryConfig: {
        maxAttempts: 16,
        maxBackoff: '600s',
        minBackoff: '60s',
      },
    },
  );
  return {
    fullQualifiedQueueName: pulumi.interpolate`projects/${queue.project}/locations/${queue.location}/queues/${queue.name}`,
  };
}

export function createProductDetailMainTaskQueue() {
  const queue = new cloudtasks.Queue(resourceName`product-detail`, {
    location: getLocation(),
    rateLimits: {
      maxConcurrentDispatches: 32,
      maxDispatchesPerSecond: 16,
    },
    retryConfig: {
      maxAttempts: 16,
      maxBackoff: '600s',
      minBackoff: '60s',
    },
  });
  return {
    fullQualifiedQueueName: pulumi.interpolate`projects/${queue.project}/locations/${queue.location}/queues/${queue.name}`,
  };
}

export function createProductDetailTaskQueue(productSource: PRODUCT_SOURCE) {
  const queue = new cloudtasks.Queue(
    resourceName`${productSource}-product-detail`,
    {
      location: getLocation(),
      rateLimits: {
        maxConcurrentDispatches: 4,
        maxDispatchesPerSecond: 2,
      },
      retryConfig: {
        maxAttempts: 16,
        maxBackoff: '600s',
        minBackoff: '60s',
      },
    },
  );
  return {
    fullQualifiedQueueName: pulumi.interpolate`projects/${queue.project}/locations/${queue.location}/queues/${queue.name}`,
  };
}
