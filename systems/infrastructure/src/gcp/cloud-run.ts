import { cloudrun, cloudrunv2 } from '@pulumi/gcp';
import pulumi, { type Output } from '@pulumi/pulumi';

import { getGcpConfig } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

const appConfig = new pulumi.Config('app');

export async function createCloudRunForWeb({
  apiEndpoint,
}: {
  apiEndpoint: Output<string>;
}) {
  const webImage = appConfig.get('web-image');
  const cloudRunService = new cloudrunv2.Service(resourceName`web`, {
    location: getGcpConfig(),
    template: {
      containers: [
        Object.assign(
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
              {
                name: 'WEB_ENV',
                value: 'production',
              },
            ],
            image: webImage ?? 'us-docker.pkg.dev/cloudrun/container/hello',
          },
          webImage
            ? {
                args: ['./scripts/docker/start.sh'],
                commands: ['sh'],
              }
            : {},
        ),
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
  projectSearchTopicId,
}: {
  databaseName: Output<string>;
  projectSearchTopicId: Output<string>;
}) {
  const apiImage = appConfig.get('api-image');
  const cloudRunService = new cloudrunv2.Service(resourceName`api`, {
    ingress: 'INGRESS_TRAFFIC_ALL',
    location: getGcpConfig(),

    template: {
      containers: [
        Object.assign(
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
              {
                name: 'API_ENV',
                value: 'production',
              },
              {
                name: 'API_PRODUCT_SEARCH_TOPIC',
                value: projectSearchTopicId,
              },
            ],
            image: apiImage ?? 'us-docker.pkg.dev/cloudrun/container/hello',
            resources: {
              limits: {
                memory: '2048Mi',
              },
            },
          },
          apiImage
            ? {
                args: ['./scripts/docker/start.sh'],
                commands: ['sh'],
              }
            : {},
        ),
      ],
    },
  });

  return {
    name: cloudRunService.name,
    serviceAccount: cloudRunService.template.serviceAccount,
    url: cloudRunService.uri,
  };
}

export async function createCloudRunForBackgroundProductSearch({
  databaseName,
  projectDetailTopicId,
}: {
  databaseName: Output<string>;
  projectDetailTopicId: Output<string>;
}) {
  const bgProductSearchImage = appConfig.get('bg-product-search-image');
  const cloudRunService = new cloudrunv2.Service(
    resourceName`bg-product-search`,
    {
      ingress: 'INGRESS_TRAFFIC_ALL',
      location: getGcpConfig(),

      template: {
        containers: [
          Object.assign(
            {
              envs: [
                {
                  name: 'BG_PRODUCT_SEARCH_DATABASE_ID',
                  value: databaseName,
                },
                {
                  name: 'BG_PRODUCT_SEARCH_PORT',
                  value: '8080',
                },
                {
                  name: 'BG_PRODUCT_SEARCH_ENV',
                  value: 'production',
                },
                {
                  name: 'BG_PRODUCT_DETAIL_TOPIC',
                  value: projectDetailTopicId,
                },
              ],
              image:
                bgProductSearchImage ??
                'us-docker.pkg.dev/cloudrun/container/hello',
              resources: {
                limits: {
                  memory: '2048Mi',
                },
              },
            },
            bgProductSearchImage
              ? {
                  args: ['./scripts/docker/start.sh'],
                  commands: ['sh'],
                }
              : {},
          ),
        ],
      },
    },
  );

  return {
    name: cloudRunService.name,
    serviceAccount: cloudRunService.template.serviceAccount,
    url: cloudRunService.uri,
  };
}

export async function createCloudRunForBackgroundProductDetail({
  databaseName,
}: {
  databaseName: Output<string>;
}) {
  const bgProductDetailImage = appConfig.get('bg-product-detail-image');
  const cloudRunService = new cloudrunv2.Service(
    resourceName`bg-product-detail`,
    {
      ingress: 'INGRESS_TRAFFIC_ALL',
      location: getGcpConfig(),

      template: {
        containers: [
          Object.assign(
            {
              envs: [
                {
                  name: 'BG_PRODUCT_DETAIL_DATABASE_ID',
                  value: databaseName,
                },
                {
                  name: 'BG_PRODUCT_DETAIL_PORT',
                  value: '8080',
                },
                {
                  name: 'BG_PRODUCT_DETAIL_ENV',
                  value: 'production',
                },
              ],
              image:
                bgProductDetailImage ??
                'us-docker.pkg.dev/cloudrun/container/hello',
              resources: {
                limits: {
                  memory: '2048Mi',
                },
              },
            },
            bgProductDetailImage
              ? {
                  args: ['./scripts/docker/start.sh'],
                  commands: ['sh'],
                }
              : {},
          ),
        ],
      },
    },
  );

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

export function allowServiceAccountToCallBackgroundProductSearch({
  backgroundProductSearchCloudRunServiceName,
  serviceAccountEmail,
}: {
  backgroundProductSearchCloudRunServiceName: Output<string>;
  serviceAccountEmail: Output<string>;
}) {
  new cloudrun.IamBinding(
    resourceName`allow-service-account-to-call-product-search`,
    {
      members: [
        serviceAccountEmail.apply(
          serviceAccount => `serviceAccount:${serviceAccount}`,
        ),
      ],
      role: 'roles/run.invoker',
      service: backgroundProductSearchCloudRunServiceName,
    },
  );
}

export function allowServiceAccountToCallBackgroundProductDetail({
  backgroundProductDetailCloudRunServiceName,
  serviceAccountEmail,
}: {
  backgroundProductDetailCloudRunServiceName: Output<string>;
  serviceAccountEmail: Output<string>;
}) {
  new cloudrun.IamBinding(
    resourceName`allow-service-account-to-call-product-detail`,
    {
      members: [
        serviceAccountEmail.apply(
          serviceAccount => `serviceAccount:${serviceAccount}`,
        ),
      ],
      role: 'roles/run.invoker',
      service: backgroundProductDetailCloudRunServiceName,
    },
  );
}
