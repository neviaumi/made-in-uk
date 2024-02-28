/* eslint-disable n/no-extraneous-import*/

import path from 'node:path';

import { storage } from '@pulumi/gcp';
import type { Output } from '@pulumi/pulumi';
import pulumi from '@pulumi/pulumi';

import { isRunningOnLocal } from '../../utils/is-running-on-local.ts';
import { resourceName } from '../../utils/resourceName.ts';
import { valueNa } from '../../utils/value-na.ts';

const currentDir = path.parse(new URL(import.meta.url).pathname).dir;

export function createSamplePubSubSubscriberCodeArchive({
  bucket,
}: {
  bucket: Output<string>;
}) {
  if (isRunningOnLocal()) {
    return {
      bucket: valueNa,
      object: valueNa,
    };
  }
  const code = new storage.BucketObject(
    resourceName`sample-pub-sub-subscriber-code-archive`,
    {
      bucket,
      source: new pulumi.asset.AssetArchive({
        '.': new pulumi.asset.FileArchive(
          path.join(currentDir, 'sample-pub-sub-subscriber'),
        ),
      }),
    },
  );
  return {
    bucket: code.bucket,
    object: code.name,
  };
}
