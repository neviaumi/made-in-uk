import { describe, expect, it, vi } from 'vitest';
import {
  config as winstonConfig,
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';

describe('winston', () => {
  describe('format', () => {
    it('should include severity into result', () => {
      const includeSeverity = vi.fn(info => {
        return Object.assign(info, {
          severity: info.level.toUpperCase(),
        });
      });
      const logger = createWinstonLogger({
        format: format.combine(
          format.timestamp(),
          format(includeSeverity)(),
          format.json(),
        ),
        levels: winstonConfig.syslog.levels,
        transports: [new transports.Console({})],
      });
      logger.emerg('test winston format');
      expect(includeSeverity).toHaveBeenCalled();
    });
  });
});
