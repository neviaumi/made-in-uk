import { describe, expect, it } from '@jest/globals';
import { TerminusModule } from '@nestjs/terminus';

import { createRequestAgent } from '../test-helpers/create-request-agent';
import { withResponseCodeCheck } from '../test-helpers/expect-response-code';
import {
  createTestingServer,
  withAPIServer,
} from '../test-helpers/with-api-server';
import { HealthModule } from './health.module';

describe('GET /healthz', () => {
  const appContext = withAPIServer(
    createTestingServer({
      imports: [TerminusModule, HealthModule],
    }),
  );
  it('/healthz (GET)', async () => {
    const app = appContext.app;
    const { body } = await withResponseCodeCheck({
      expectedStatusCode: 200,
    })(createRequestAgent(app.getHttpServer()).get('/healthz'));
    expect(body).toStrictEqual({
      details: {
        api: {
          status: 'up',
        },
        database: {
          status: 'up',
        },
      },
      error: {},
      info: {
        api: {
          status: 'up',
        },
        database: {
          status: 'up',
        },
      },
      status: 'ok',
    });
  });
});
