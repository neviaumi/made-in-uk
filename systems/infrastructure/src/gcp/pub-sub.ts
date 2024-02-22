import { pubsub } from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

import { resourceName } from '../utils/resourceName.ts';

export function createPubSubTopics() {
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
