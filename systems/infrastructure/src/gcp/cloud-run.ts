import { cloudrun, cloudrunv2 } from '@pulumi/gcp';
import pulumi, { type Output } from '@pulumi/pulumi';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

const appConfig = new pulumi.Config('app');

export function createCloudRunForWeb({
  apiEndpoint,
}: {
  apiEndpoint: Output<string>;
}) {
  const webImage = appConfig.get('web-image');
  const cloudRunService = new cloudrunv2.Service(resourceName`web`, {
    location: getLocation(),
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

export function createCloudRunForApi({
  databaseName,
  productSearchEndpoint,
  productSearchTaskQueue,
}: {
  databaseName: Output<string>;
  productSearchEndpoint: Output<string>;
  productSearchTaskQueue: Output<string>;
}) {
  const apiImage = appConfig.get('api-image');
  const cloudRunService = new cloudrunv2.Service(resourceName`api`, {
    ingress: 'INGRESS_TRAFFIC_ALL',
    location: getLocation(),

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
                name: 'API_PRODUCT_SEARCH_ENDPOINT',
                value: productSearchEndpoint,
              },
              {
                name: 'API_PRODUCT_SEARCH_QUEUE',
                value: productSearchTaskQueue,
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
      timeout: '900s',
    },
  });

  return {
    name: cloudRunService.name,
    serviceAccount: cloudRunService.template.serviceAccount,
    url: cloudRunService.uri,
  };
}

export function createCloudRunForBackgroundProductSearch({
  databaseName,
  productDetailEndpoint,
  productDetailTaskQueue,
}: {
  databaseName: Output<string>;
  productDetailEndpoint: Output<string>;
  productDetailTaskQueue: Output<string>;
}) {
  const bgProductSearchImage = appConfig.get('bg-product-search-image');
  const cloudRunService = new cloudrunv2.Service(
    resourceName`bg-product-search`,
    {
      ingress: 'INGRESS_TRAFFIC_ALL',
      location: getLocation(),

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
                  name: 'BG_PRODUCT_SEARCH_PRODUCT_DETAIL_ENDPOINT',
                  value: productDetailEndpoint,
                },
                {
                  name: 'BG_PRODUCT_SEARCH_PRODUCT_DETAIL_QUEUE',
                  value: productDetailTaskQueue,
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

export function createCloudRunForBackgroundProductDetail({
  databaseName,
}: {
  databaseName: Output<string>;
}) {
  const bgProductDetailImage = appConfig.get('bg-product-detail-image');
  const cloudRunService = new cloudrunv2.Service(
    resourceName`bg-product-detail`,
    {
      ingress: 'INGRESS_TRAFFIC_ALL',
      location: getLocation(),
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

export function allowAPIToCallBackgroundProductSearch({
  apiCloudRunServiceAccount,
  backgroundProductSearchCloudRunServiceName,
}: {
  apiCloudRunServiceAccount: Output<string>;
  backgroundProductSearchCloudRunServiceName: Output<string>;
}) {
  new cloudrun.IamBinding(resourceName`allow-api-to-call-product-search`, {
    members: [
      apiCloudRunServiceAccount.apply(
        serviceAccount => `serviceAccount:${serviceAccount}`,
      ),
    ],
    role: 'roles/run.invoker',
    service: backgroundProductSearchCloudRunServiceName,
  });
}

export function allowProductSearchToCallBackgroundProductDetail({
  backgroundProductDetailCloudRunServiceName,
  productSearchCloudRunServiceAccount,
}: {
  backgroundProductDetailCloudRunServiceName: Output<string>;
  productSearchCloudRunServiceAccount: Output<string>;
}) {
  new cloudrun.IamBinding(
    resourceName`allow-service-account-to-call-product-detail`,
    {
      members: [
        productSearchCloudRunServiceAccount.apply(
          serviceAccount => `serviceAccount:${serviceAccount}`,
        ),
      ],
      role: 'roles/run.invoker',
      service: backgroundProductDetailCloudRunServiceName,
    },
  );
}
