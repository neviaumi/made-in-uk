import { cloudfunctionsv2 } from '@pulumi/gcp';
import type { Output } from '@pulumi/pulumi';

import { getProjectRegion } from '../../utils/get-project-region.ts';
import { resourceName } from '../../utils/resourceName.ts';

export function createCloudFunctions({
  firestore,
  source,
  topic,
}: {
  firestore: { id: Output<string> };
  source: { bucket: Output<string>; object: Output<string> };
  topic: { name: Output<string> };
}) {
  return new cloudfunctionsv2.Function(resourceName`pub-sub-subscriber`, {
    buildConfig: {
      entryPoint: 'topic-subscriber',
      runtime: 'nodejs20',
      source: {
        storageSource: {
          bucket: source.bucket,
          object: source.object,
        },
      },
    },
    eventTrigger: {
      eventType: 'google.cloud.pubsub.topic.v1.messagePublished',
      pubsubTopic: topic.name,
    },
    location: getProjectRegion(),
    serviceConfig: {
      environmentVariables: {
        FIRESTORE_DB: firestore.id,
      },
      timeoutSeconds: 60,
    },
  });
}
