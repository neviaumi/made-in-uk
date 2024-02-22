/* eslint-disable n/no-extraneous-import*/

import path from 'node:path';

import { getRemoteImage, Image } from '@pulumi/docker';
import type { Output } from '@pulumi/pulumi';

import { isRunningOnLocal } from '../../utils/isRunningOnLocal.ts';
import { resourceName } from '../../utils/resourceName.ts';
import packageJson from './sample-api/package.json' with { type: 'json' };

const currentDir = path.parse(new URL(import.meta.url).pathname).dir;

export function createApiSampleImage({
  repositoryUrl,
}: {
  repositoryUrl: Output<string>;
}) {
  const apiImage = repositoryUrl.apply(async repositoryUrl => {
    const sampleApiVersion = packageJson['version'] as string;
    const apiImage = isRunningOnLocal()
      ? `${repositoryUrl}/sample-api:${sampleApiVersion}`
      : `${repositoryUrl}/sample-api:0.0.0`;
    return await getRemoteImage({
      name: apiImage,
    })
      .then(result => {
        return {
          id: result.name,
          // name: result.name,
        };
      })
      .catch(() => {
        const image = new Image(resourceName`sample-api-image`, {
          build: {
            context: path.join(currentDir, 'sample-api'),
          },
          imageName: apiImage,
        });
        return {
          id: image.id,
          // name: image.imageName,
        };
      });
  });
  return {
    imageId: apiImage.id,
  };
}
