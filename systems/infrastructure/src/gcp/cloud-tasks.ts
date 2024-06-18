import { cloudtasks } from '@pulumi/gcp';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createProductSearchTaskQueue() {
  const queue = new cloudtasks.Queue(resourceName`product-search`, {
    location: getLocation(),
    rateLimits: {
      maxConcurrentDispatches: 1,
      maxDispatchesPerSecond: 1,
    },
  });
  return {
    name: queue.name,
    urn: queue.urn,
  };
}

export function createProductDetailTaskQueue() {
  const queue = new cloudtasks.Queue(resourceName`product-detail`, {
    location: getLocation(),
    rateLimits: {
      maxConcurrentDispatches: 1,
      maxDispatchesPerSecond: 1,
    },
  });
  return {
    name: queue.name,
    urn: queue.urn,
  };
}
