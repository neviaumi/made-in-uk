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
              name: 'WEB_BACKEND_HOST',
              value: apiEndpoint,
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
    serviceAccount: cloudRunService.template.serviceAccount,
    url: cloudRunService.uri,
  };
}

export async function createCloudRunForApi({
  databaseName,
  simpleApiImage,
  topicId,
}: {
  databaseName: Output<string>;
  simpleApiImage: Output<string>;
  topicId: Output<string>;
}) {
  const cloudRunService = new cloudrunv2.Service(resourceName`api`, {
    ingress: 'INGRESS_TRAFFIC_ALL',
    location: getProjectRegion(),

    template: {
      containers: [
        {
          envs: [
            {
              name: 'FIRESTORE_DB',
              value: databaseName,
            },
            {
              name: 'TOPIC_ID',
              value: topicId,
            },
          ],
          image: simpleApiImage,
        },
      ],
    },
  });
  // new cloudrun.IamBinding(resourceName`allow-any-user-iam-binding`, {
  //   members: ['allUsers'],
  //   role: 'roles/run.invoker',
  //   service: cloudRunService.name,
  // });

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
