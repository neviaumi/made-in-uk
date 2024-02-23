import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorStatus,
} from '@nestjs/terminus';

import { DatabaseConnection } from '../database/database.module';

@Controller('/healthz')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly databaseConnection: DatabaseConnection,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const databaseStatus = await this.databaseConnection
      .proxy()
      .collection('health')
      .doc('api')
      .set({ status: 'up' })
      .then(() => ({ status: 'up' as HealthIndicatorStatus }))
      .catch(err => ({
        error: err.message,
        status: 'down' as HealthIndicatorStatus,
      }));
    return this.health.check([
      () => ({
        api: {
          status: 'up',
        },
        database: databaseStatus,
      }),
    ]);
  }
}
