import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

import { APP_ENV, loadConfig } from '@/config.server.ts';
import type { OperationResult } from '@/deps/urql.ts';
import { Level, levels } from '@/logger.types.ts';
import { AppEnvironment } from '@/types.ts';

const config = loadConfig(APP_ENV);

export type { Logger } from 'winston';

export function formatURQLResult(result: OperationResult<unknown>) {
  return {
    data: result.data,
    error: result.error,
    hasNext: result.hasNext,
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
