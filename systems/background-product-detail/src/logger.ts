import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

import { AppEnvironment } from '@/config.ts';
import { Level } from '@/logger.types.ts';

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
