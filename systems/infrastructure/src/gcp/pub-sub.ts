import { pubsub } from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

import { isRunningOnLocal } from '../utils/is-running-on-local.ts';
import { resourceName } from '../utils/resourceName.ts';
import { valueNa } from '../utils/value-na.ts';

export function createPubSubTopics() {
  if (isRunningOnLocal()) {
    return { topicId: valueNa, topicName: valueNa, topicUrn: valueNa };
  }
  const eventSchema = new pubsub.Schema(resourceName`pubsub-event-schema`, {
    definition: `{
  "type" : "record",
  "name" : "Avro",
  "fields" : [
    {
      "name" : "requestId",
      "type" : "string"
    },
    {
      "name" : "data",
      "type" : "string"
    }
  ]
}
`,
    type: 'AVRO',
  });
  const exampleTopic = new pubsub.Topic(
    resourceName`example-topic`,
    {
      schemaSettings: {
        encoding: 'JSON',
        schema: pulumi.interpolate`projects/${eventSchema.project}/schemas/${eventSchema.name}`,
      },
    },
    {
      dependsOn: [eventSchema],
    },
  );
  return {
    topicId: exampleTopic.id,
    topicName: exampleTopic.name,
    topicUrn: exampleTopic.urn,
  };
}
