/* eslint-disable n/no-extraneous-import*/

import path from 'node:path';

import { getRemoteImage, Image } from '@pulumi/docker';
import type { Output } from '@pulumi/pulumi';

import { isRunningOnLocal } from '../../utils/isRunningOnLocal.ts';
import { resourceName } from '../../utils/resourceName.ts';
import packageJson from './sample-web/package.json' with { type: 'json' };

const currentDir = path.parse(new URL(import.meta.url).pathname).dir;

export function createWebSampleImage({
  repositoryUrl,
}: {
  repositoryUrl: Output<string>;
}) {
  return repositoryUrl.apply(async repositoryUrl => {
    const sampleApiVersion = packageJson['version'] as string;
    const apiImage = isRunningOnLocal()
      ? `${repositoryUrl}/sample-web:${sampleApiVersion}`
      : `${repositoryUrl}/sample-web:0.0.0`;
    const { exist: isImageExist } = await getRemoteImage({
      name: apiImage,
    })
      .then(() => ({
        exist: true,
      }))
      .catch(() => ({
        exist: false,
      }));
    const image = new Image(resourceName`sample-web-image`, {
      build: {
        context: path.join(currentDir, 'sample-web'),
        platform: 'linux/amd64',
      },
      buildOnPreview: !isImageExist,
      imageName: apiImage,
    });
    return {
      imageId: image.id,
    };
  });
}
