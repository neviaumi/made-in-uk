import {
  config as winstonConfig,
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

import { AppEnvironment } from '@/config.ts';

const logLevels = winstonConfig.syslog.levels;

export type { Logger } from 'winston';
export function createLogger(appEnv: AppEnvironment) {
  const isDev = [AppEnvironment.DEV].includes(appEnv);
  return createWinstonLogger({
    format: format.combine(
      format.timestamp(),
      format(function includeGCPSeverity(info) {
        const gcpSeverityMapping = Object.fromEntries(
          Object.keys(logLevels).map(level => {
            if (['emerg', 'crit'].includes(level)) {
              if (level === 'emerg') {
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
        ? [format.prettyPrint({ colorize: true, depth: 4 })]
        : [format.json()]),
    ),
    level: isDev ? 'debug' : 'info',
    levels: logLevels,
    silent: [AppEnvironment.TEST].includes(appEnv),
    transports: [new transports.Console({})],
  });
}
