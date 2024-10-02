import { Level } from '@/logger.types.ts';

export enum AppEnvironment {
  DEV = 'development',
  PRD = 'production',
  TEST = 'test',
}
export const APP_ENV: AppEnvironment = process.env[
  'WEB_ENV'
]! as AppEnvironment;

if (
  !(function checkAppEnvValid(
    appEnv: string | undefined,
  ): appEnv is AppEnvironment {
    return (
      appEnv !== undefined &&
      Object.values<string>(AppEnvironment).includes(appEnv)
    );
  })(APP_ENV)
) {
  throw new Error(`
        Invalid WEB_ENV value: ${APP_ENV}
        possible values: ${Object.values<string>(AppEnvironment).join('/ ')}
    `);
}

function requireEnv(key: string) {
  if (!process.env[key]) {
    throw new Error(`${key} is not defined`);
  }
  return process.env[key]!;
}

function pickEnv(key: string) {
  return process.env[key] || '';
}
export function loadConfig(appEnv: AppEnvironment) {
  return new Map([
    ['env', appEnv],
    ['log.level', Level.info],
    [
      'firebase.auth.emulatorHost',
      [AppEnvironment.TEST, AppEnvironment.DEV].includes(appEnv)
        ? requireEnv('FIREBASE_AUTH_EMULATOR_HOST')
        : pickEnv('FIREBASE_AUTH_EMULATOR_HOST'),
    ],
    [
      'api.endpoint',
      ![AppEnvironment.TEST].includes(appEnv)
        ? requireEnv('WEB_API_HOST')
        : pickEnv('WEB_API_HOST'),
    ],
  ]);
}

export type ConfigServer = ReturnType<typeof loadConfig>;
