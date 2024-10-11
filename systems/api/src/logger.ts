import { type YogaLogger } from 'graphql-yoga';
import {
  createLogger as createWinstonLogger,
  format,
  Logger,
  transports,
} from 'winston';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import { Level, levels } from '@/logger.types.ts';

const config = loadConfig(APP_ENV);
export { Logger };

export function toYogaLogger(logger: Logger): YogaLogger {
  function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }
  function transferParamsToWinstonLoggerParams(...args: unknown[]) {
    const [message, ...rest] = args;
    const extra = rest.length > 0 && isRecord(rest[0]) ? rest[0] : null;
    const additional = rest.length > 1 ? rest.slice(1) : null;

    if (typeof message === 'string') {
      if (additional) {
        logger.warning('Additional parameters are not supported', {
          args,
        });
      }
      return [message, extra] as const;
    }
    if (isRecord(message) && message['message']) {
      const { message: messageString, ...restMessageObject } = message;
      if (extra || additional) {
        logger.warning('Additional parameters are not supported', {
          args,
        });
      }
      return [String(messageString), restMessageObject] as const;
    }
    logger.warning('Logging has been dropped due to incorrect call of logger', {
      args,
    });
    return args as any[];
  }
  return {
    debug: (...args: any[]) => {
      const [message, meta] = transferParamsToWinstonLoggerParams(...args);
      logger.debug(message, meta);
    },
    error: (...args: any[]) => {
      const [message, meta] = transferParamsToWinstonLoggerParams(...args);
      logger.error(message, meta);
    },
    info: (...args: any[]) => {
      const [message, meta] = transferParamsToWinstonLoggerParams(...args);
      logger.info(message, meta);
    },
    warn: (...args: any[]) => {
      const [message, meta] = transferParamsToWinstonLoggerParams(...args);
      logger.warning(message, meta);
    },
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
        ? [format.prettyPrint({ colorize: true, depth: 2 })]
        : [format.json()]),
    ),
    level: config.get('log.level'),
    levels: levels,
    silent: config.get('log.silent'),
    transports: [new transports.Console({})],
  });
}
