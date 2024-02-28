import { artifactregistry } from '@pulumi/gcp';
import { RandomPet } from '@pulumi/random';

import { isRunningOnLocal } from '../../utils/is-running-on-local.ts';
import { resourceName } from '../../utils/resourceName.ts';
import { valueNa } from '../../utils/value-na.ts';

export function createDockerRepository() {
  if (isRunningOnLocal()) {
    return {
      repositoryUrl: valueNa,
    };
  }
  const repositoryId = new RandomPet(resourceName`docker-repository-id`, {
    length: 2,
  });
  const registry = new artifactregistry.Repository(
    resourceName`docker-repository`,
    {
      dockerConfig: {
        immutableTags: true,
      },
      format: 'DOCKER',
      repositoryId: repositoryId.id.apply(id => `docker-${id.toLowerCase()}`),
    },
  );
  const repositoryUrl = registry.id.apply(registryId => {
    const [, registryProject, , registryLocation, , registryName] =
      registryId.split('/');
    return `${registryLocation}-docker.pkg.dev/${registryProject}/${registryName}`;
  });
  return { repositoryUrl };
}
