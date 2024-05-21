import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const projectRoot = fileURLToPath(new URL('../../../..', import.meta.url));

export const APP_ENV: AppEnvironment = process.env[
  'API_ENV'
]! as AppEnvironment;

export enum AppEnvironment {
  DEV = 'development',
  PRD = 'production',
  TEST = 'test',
}

export function loadEnvFileByAppEnv(appEnv: string | undefined) {
  const checkAppEnvValid = (
    appEnv: string | undefined,
  ): appEnv is AppEnvironment =>
    appEnv !== undefined &&
    Object.values<string>(AppEnvironment).includes(appEnv);
  if (!checkAppEnvValid(appEnv)) {
    throw new Error(`
      Invalid API_ENV value: ${appEnv}
      possible values: ${Object.values<string>(AppEnvironment).join('/ ')}
`);
  }
  if (![AppEnvironment.DEV, AppEnvironment.TEST].includes(appEnv)) {
    return appEnv;
  }
  dotenvExpand.expand(
    dotenv.config({
      path: path.join(projectRoot, '.env'),
    }),
  );
  return appEnv;
}
