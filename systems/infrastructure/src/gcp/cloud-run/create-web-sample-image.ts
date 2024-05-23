/* eslint-disable n/no-extraneous-import*/

import path from 'node:path';

import {
  getRemoteImage,
  type GetRemoteImageResult,
  Image,
} from '@pulumi/docker';
import type { Output } from '@pulumi/pulumi';

import { isRunningOnLocal } from '../../utils/is-running-on-local.ts';
import { resourceName } from '../../utils/resourceName.ts';
import { valueNa } from '../../utils/value-na.ts';
import packageJson from './sample-web/package.json' with { type: 'json' };

const currentDir = path.parse(new URL(import.meta.url).pathname).dir;

export function createWebSampleImage({
  repositoryUrl,
}: {
  repositoryUrl: Output<string>;
}) {
  if (isRunningOnLocal()) {
    return {
      imageId: valueNa,
    };
  }
  return repositoryUrl.apply(async repositoryUrl => {
    const sampleApiVersion = packageJson['version'] as string;
    const apiImage = isRunningOnLocal()
      ? `${repositoryUrl}/sample-web:${sampleApiVersion}`
      : `${repositoryUrl}/sample-web:0.0.0`;
    const remoteImage:
      | {
          exist: true;
          image: GetRemoteImageResult;
        }
      | {
          exist: false;
        } = await getRemoteImage({
      name: apiImage,
    })
      .then(image => ({
        exist: true,
        image,
      }))
      .catch(() => ({
        exist: false,
      }));
    if (remoteImage.exist) {
      return { imageId: remoteImage.image.id };
    }
    const image = new Image(resourceName`sample-web-image`, {
      build: {
        context: path.join(currentDir, 'sample-web'),
        platform: 'linux/amd64',
      },
      buildOnPreview: !remoteImage.exist,
      imageName: apiImage,
    });
    return {
      imageId: image.id,
    };
  });
}
