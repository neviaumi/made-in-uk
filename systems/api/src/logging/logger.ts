import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

import { AppEnvironment } from '@/config/app-env.ts';

import { Level } from './logging.constants.ts';

export type { Logger } from 'winston';
export function createLogger(appEnv: AppEnvironment) {
  const isDev = [AppEnvironment.DEV].includes(appEnv);
  return createWinstonLogger({
    format: format.combine(
      format.timestamp(),
      ...(isDev
        ? [format.prettyPrint({ colorize: true, depth: 4 })]
        : [format.json()]),
    ),
    level: isDev ? Level.debug : Level.info,
    silent: [AppEnvironment.TEST].includes(appEnv),
    transports: [new transports.Console({})],
  });
}
