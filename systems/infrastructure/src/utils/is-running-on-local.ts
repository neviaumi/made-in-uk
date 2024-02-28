import * as pulumi from '@pulumi/pulumi';

export function isRunningOnLocal() {
  return ['local', 'test'].includes(pulumi.getStack());
}
