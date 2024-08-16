import { config as winstonConfig } from 'winston';

export const Level = Object.fromEntries(
  Object.keys(winstonConfig.syslog.levels).map(level => [level, level]),
) as {
  [key in keyof typeof winstonConfig.syslog.levels]: string;
};

export const levels = winstonConfig.syslog.levels;
