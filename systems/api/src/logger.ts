import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

import { AppEnvironment } from '@/config.ts';

// default levels: https://github.com/winstonjs/triple-beam/blob/c2991b2b7ff2297a6b57bce8a8d8b70f4183b019/config/npm.js#L15-L21
enum Level {
  debug = 'debug',
  error = 'error',
  http = 'http',
  info = 'info',
  silly = 'silly',
  verbose = 'verbose',
  warn = 'warn',
}

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
