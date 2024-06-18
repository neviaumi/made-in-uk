import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config('gcp');

export function getLocation() {
  return config.require('region');
}

export function getProjectId() {
  return config.require('project');
}
