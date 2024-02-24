import { cloudrun, cloudrunv2 } from '@pulumi/gcp';
import type { Output } from '@pulumi/pulumi';

import { getProjectRegion } from '../../utils/get-project-region.ts';
import { resourceName } from '../../utils/resourceName.ts';

export async function createCloudRunForWeb({
  apiEndpoint,
  simpleWebImage,
}: {
  apiEndpoint: Output<string>;
  simpleWebImage: Output<string>;
}) {
  const cloudRunService = new cloudrunv2.Service(resourceName`web`, {
    location: getProjectRegion(),
    template: {
      containers: [
        {
          envs: [
            {
              name: 'WEB_API_HOST',
              value: apiEndpoint,
            },
            {
              name: 'WEB_PORT',
              value: '8080',
            },
          ],
          image: simpleWebImage,
        },
      ],
    },
  });
  new cloudrun.IamBinding(resourceName`allow-any-user-iam-binding`, {
    members: ['allUsers'],
    role: 'roles/run.invoker',
    service: cloudRunService.name,
  });

  return {
    name: cloudRunService.name,
    serviceAccount: cloudRunService.template.serviceAccount,
    url: cloudRunService.uri,
  };
}

export async function createCloudRunForApi({
  databaseName,
  simpleApiImage,
}: {
  databaseName: Output<string>;
  simpleApiImage: Output<string>;
}) {
  const cloudRunService = new cloudrunv2.Service(resourceName`api`, {
    ingress: 'INGRESS_TRAFFIC_ALL',
    location: getProjectRegion(),

    template: {
      containers: [
        {
          envs: [
            {
              name: 'API_DATABASE_ID',
              value: databaseName,
            },
            {
              name: 'API_PORT',
              value: '8080',
            },
          ],
          image: simpleApiImage,
        },
      ],
    },
  });

  return {
    name: cloudRunService.name,
    serviceAccount: cloudRunService.template.serviceAccount,
    url: cloudRunService.uri,
  };
}

export function onlyAllowServiceToServiceForInvokeAPI({
  apiCloudRunServiceName,
  webCloudRunServiceAccount,
}: {
  apiCloudRunServiceName: Output<string>;
  webCloudRunServiceAccount: Output<string>;
}) {
  new cloudrun.IamBinding(resourceName`allow-service-to-service-iam-binding`, {
    members: [
      webCloudRunServiceAccount.apply(
        serviceAccount => `serviceAccount:${serviceAccount}`,
      ),
    ],
    role: 'roles/run.invoker',
    service: apiCloudRunServiceName,
  });
}
