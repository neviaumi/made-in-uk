import { firebase } from '@pulumi/gcp';

import { resourceName } from '../utils/resourceName.ts';

export function createFireBaseProject() {
  const firebaseProject = new firebase.Project(resourceName`firebase`);
  return { name: firebaseProject.displayName };
}
