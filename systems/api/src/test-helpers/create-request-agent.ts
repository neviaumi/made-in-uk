import type { INestApplication } from '@nestjs/common';
import { agent, type SuperAgentTest } from 'supertest';

// @ts-expect-error no type for test only file
import { getTestName, getTestPath } from './jest/get-test-state';

export function createRequestAgent(app: INestApplication<any>) {
  return agent(app as any).set({
    'X-Test-Name': encodeURI(getTestName()),
    'X-Test-Path': encodeURI(getTestPath()),
  }) as unknown as SuperAgentTest;
}
