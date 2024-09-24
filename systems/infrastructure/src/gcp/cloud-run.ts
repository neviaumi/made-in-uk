import { cloudrun, cloudrunv2 } from '@pulumi/gcp';
import pulumi, { type Output } from '@pulumi/pulumi';

import { PRODUCT_SOURCE } from '../types.ts';
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
            livenessProbe: {
              httpGet: {
                path: '/health',
              },
            },
            startupProbe: {
              httpGet: {
                path: '/health',
              },
            },
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
  productDetailEndpoint,
  productDetailTaskQueue,
  productSearchEndpoint,
  productSearchTaskQueue,
}: {
  databaseName: Output<string>;
  productDetailEndpoint: Output<string>;
  productDetailTaskQueue: Output<string>;
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
              {
                name: 'API_PRODUCT_DETAIL_ENDPOINT',
                value: productDetailEndpoint,
              },
              {
                name: 'API_PRODUCT_DETAIL_QUEUE',
                value: productDetailTaskQueue,
              },
            ],
            image: apiImage ?? 'us-docker.pkg.dev/cloudrun/container/hello',
            livenessProbe: {
              httpGet: {
                path: '/ready',
              },
            },
            resources: {
              limits: {
                memory: '2048Mi',
              },
            },
            startupProbe: {
              httpGet: {
                path: '/health',
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
  subTaskQueues,
}: {
  databaseName: Output<string>;
  productDetailEndpoint: Output<string>;
  productDetailTaskQueue: Output<string>;
  subTaskQueues: {
    [PRODUCT_SOURCE.SAINSBURY]: Output<string>;
    [PRODUCT_SOURCE.OCADO]: Output<string>;
  };
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
                {
                  name: 'BG_PRODUCT_SEARCH_SAINSBURY_PRODUCT_SEARCH_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.SAINSBURY],
                },
                {
                  name: 'BG_PRODUCT_SEARCH_OCADO_PRODUCT_SEARCH_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.OCADO],
                },
              ],
              image:
                bgProductSearchImage ??
                'us-docker.pkg.dev/cloudrun/container/hello',
              livenessProbe: {
                httpGet: {
                  path: '/health',
                },
              },
              resources: {
                limits: {
                  memory: '2048Mi',
                },
              },
              startupProbe: {
                httpGet: {
                  path: '/health',
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
  llmEndpoint,
  subTaskQueues,
}: {
  databaseName: Output<string>;
  llmEndpoint: Output<string>;
  subTaskQueues: { [key in PRODUCT_SOURCE]: Output<string> };
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
                {
                  name: 'BG_PRODUCT_DETAIL_LLM_ENDPOINT',
                  value: llmEndpoint,
                },
                {
                  name: 'BG_PRODUCT_DETAIL_SAINSBURY_PRODUCT_DETAIL_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.SAINSBURY],
                },
                {
                  name: 'BG_PRODUCT_DETAIL_OCADO_PRODUCT_DETAIL_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.OCADO],
                },
                {
                  name: 'BG_PRODUCT_DETAIL_VET_SHOP_PRODUCT_DETAIL_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.VET_SHOP],
                },
                {
                  name: 'BG_PRODUCT_DETAIL_ZOOPLUS_PRODUCT_DETAIL_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.ZOOPLUS],
                },
                {
                  name: 'BG_PRODUCT_DETAIL_LILYS_KITCHEN_PRODUCT_DETAIL_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.LILYS_KITCHEN],
                },
                {
                  name: 'BG_PRODUCT_DETAIL_PETS_AT_HOME_PRODUCT_DETAIL_QUEUE',
                  value: subTaskQueues[PRODUCT_SOURCE.PETS_AT_HOME],
                },
              ],
              image:
                bgProductDetailImage ??
                'us-docker.pkg.dev/cloudrun/container/hello',
              livenessProbe: {
                httpGet: {
                  path: '/health',
                },
              },
              resources: {
                limits: {
                  memory: '2048Mi',
                },
              },
              startupProbe: {
                httpGet: {
                  path: '/health',
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

export function createCloudRunForLLM({
  databaseName,
}: {
  databaseName: Output<string>;
}) {
  const llmImage = appConfig.get('llm-image');
  const cloudRunService = new cloudrunv2.Service(resourceName`llm`, {
    ingress: 'INGRESS_TRAFFIC_ALL',
    location: getLocation(),
    template: {
      containers: [
        Object.assign(
          {
            envs: [
              {
                name: 'LLM_PORT',
                value: '8080',
              },
              {
                name: 'LLM_DATABASE_ID',
                value: databaseName,
              },
              {
                name: 'LLM_ENV',
                value: 'production',
              },
            ],
            image: llmImage ?? 'us-docker.pkg.dev/cloudrun/container/hello',
            livenessProbe: {
              httpGet: {
                path: '/health',
              },
              periodSeconds: 300,
              timeoutSeconds: 120,
            },
            resources: {
              limits: {
                cpu: '8',
                memory: '4096Mi',
              },
            },
            startupProbe: {
              httpGet: {
                path: '/health',
              },
              periodSeconds: 120,
              timeoutSeconds: 90,
            },
          },
          llmImage
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

export function allowServiceAccountsToCallBackgroundProductDetail({
  backgroundProductDetailCloudRunServiceName,
  serviceAccounts,
}: {
  backgroundProductDetailCloudRunServiceName: Output<string>;
  serviceAccounts: Array<Output<string>>;
}) {
  new cloudrun.IamBinding(
    resourceName`allow-service-accounts-to-call-product-detail`,
    {
      members: serviceAccounts.map(account =>
        account.apply(serviceAccount => `serviceAccount:${serviceAccount}`),
      ),
      role: 'roles/run.invoker',
      service: backgroundProductDetailCloudRunServiceName,
    },
  );
}

export function allowServiceAccountsToCallLLM({
  llmServiceName,
  serviceAccounts,
}: {
  llmServiceName: Output<string>;
  serviceAccounts: Array<Output<string>>;
}) {
  new cloudrun.IamBinding(resourceName`allow-service-accounts-to-call-llm`, {
    members: serviceAccounts.map(account =>
      account.apply(serviceAccount => `serviceAccount:${serviceAccount}`),
    ),
    role: 'roles/run.invoker',
    service: llmServiceName,
  });
}
