import type { FastifyBaseLogger } from 'fastify';
import {
  createLogger as createWinstonLogger,
  format,
  type Logger,
  transports,
} from 'winston';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import { Level, levels } from '@/logger.types.ts';

const config = loadConfig(APP_ENV);
type LoggerPatched = FastifyBaseLogger | Logger;

export type { LoggerPatched as Logger };

export function adaptToFastifyLogger(logger: Logger): FastifyBaseLogger {
  // see https://fastify.dev/docs/latest/Reference/Server/#logger
  return {
    child: (...args: Parameters<Logger['child']>) => {
      return adaptToFastifyLogger(logger.child(...args));
    },
    debug: logger.debug.bind(logger),
    error: logger.error.bind(logger),
    fatal: logger.error.bind(logger),
    info: logger.info.bind(logger),
    level: logger.level,
    silent: () => {},
    trace: logger.debug.bind(logger),
    warn: logger.warning.bind(logger),
  };
}

export function createLogger(appEnv: AppEnvironment) {
  const isDev = [AppEnvironment.DEV].includes(appEnv);
  return createWinstonLogger({
    format: format.combine(
      format.timestamp(),
      format(function includeGCPSeverity(info) {
        const gcpSeverityMapping = Object.fromEntries(
          Object.keys(Level).map(level => {
            if ([Level.emerg, Level.crit].includes(level)) {
              if (level === Level.emerg) {
                return [level, 'EMERGENCY'];
              }
              return [level, 'CRITICAL'];
            }
            return [level, level.toUpperCase()];
          }),
        );
        return Object.assign(info, {
          severity: gcpSeverityMapping[info.level],
        });
      })(),
      ...(isDev
        ? [format.prettyPrint({ colorize: true, depth: 16 })]
        : [format.json()]),
    ),
    level: config.get('log.level'),
    levels: levels,
    silent: [AppEnvironment.TEST].includes(appEnv),
    transports: [new transports.Console({})],
  });
}
