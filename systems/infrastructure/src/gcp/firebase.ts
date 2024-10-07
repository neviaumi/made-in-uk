import { firebase } from '@pulumi/gcp';
import type { Output } from '@pulumi/pulumi';

import { resourceName } from '../utils/resourceName.ts';

export function createFireBaseProject() {
  const firebaseProject = new firebase.Project(resourceName`firebase`);
  return {
    name: firebaseProject.displayName,
    projectId: firebaseProject.project,
  };
}

export function createFirebaseWebApp(projectId: Output<string>) {
  const firebaseWebApp = new firebase.WebApp(resourceName`web-app`, {
    displayName: 'web',
    project: projectId,
  });
  return {
    apiKeyId: firebaseWebApp.apiKeyId,
    name: firebaseWebApp.displayName,
  };
}
