import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

import { resourceName } from '../utils/resourceName.ts';

export function createProductSearchCronJob({
  productSearchEndpoint,
  serviceAccountEmail,
}: {
  productSearchEndpoint: pulumi.Output<string>;
  serviceAccountEmail: pulumi.Output<string>;
}) {
  return new gcp.cloudscheduler.Job(
    resourceName`product-search-token-bucket-refill`,
    {
      attemptDeadline: '30s',
      description: 'Refill token bucket for product search',
      httpTarget: {
        httpMethod: 'POST',
        oidcToken: {
          serviceAccountEmail: serviceAccountEmail,
        },
        uri: productSearchEndpoint.apply(baseUrl =>
          new URL('/token-bucket/refill', baseUrl).toString(),
        ),
      },
      paused: false,
      schedule: '*/15 * * * *',
      timeZone: 'UTC',
    },
  );
}

export function createProductDetailCronJob({
  productDetailEndpoint,
  serviceAccountEmail,
}: {
  productDetailEndpoint: pulumi.Output<string>;
  serviceAccountEmail: pulumi.Output<string>;
}) {
  return new gcp.cloudscheduler.Job(
    resourceName`product-detail-token-bucket-refill`,
    {
      attemptDeadline: '30s',
      description: 'Refill token bucket for product detail',
      httpTarget: {
        httpMethod: 'POST',
        oidcToken: {
          serviceAccountEmail: serviceAccountEmail,
        },
        uri: productDetailEndpoint.apply(baseUrl =>
          new URL('/token-bucket/refill', baseUrl).toString(),
        ),
      },
      paused: false,
      schedule: '*/15 * * * *',
      timeZone: 'UTC',
    },
  );
}
