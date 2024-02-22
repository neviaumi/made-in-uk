import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config('gcp');

export function getProjectRegion() {
  return config.require('region');
}
