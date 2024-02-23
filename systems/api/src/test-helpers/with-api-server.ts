import { afterAll, beforeAll } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { concat, pipe } from 'ramda';

import { AppModule } from '../app.module';
import { setupApp } from '../bootstrap';

interface NestServerContext {
  app: INestApplication;
}

export function createTestingModuleBuilder(moduleMetadata: ModuleMetadata) {
  return (extra?: ModuleMetadata) =>
    Test.createTestingModule({
      controllers: concat(
        moduleMetadata.controllers ?? [],
        extra?.controllers ?? [],
      ),
      imports: concat(moduleMetadata.imports ?? [], extra?.imports ?? []),
      providers: concat(moduleMetadata.providers ?? [], extra?.providers ?? []),
    });
}

export const createTestingAppModule = createTestingModuleBuilder({
  imports: [AppModule],
});

export const createTestingApp = async (
  testingModulePromise: TestingModule | Promise<TestingModule>,
) => {
  const testingModule = await testingModulePromise;
  return setupApp(
    testingModule.createNestApplication<NestExpressApplication>(),
  ) as INestApplication;
};
export async function startTestingServer(
  appPromise: INestApplication | Promise<INestApplication>,
) {
  const app = await appPromise;
  const config = app.get(ConfigService);
  const port =
    config.get('port') + parseInt(process.env['JEST_WORKER_ID']!, 10);
  // https://jestjs.io/docs/en/environment-variables
  await app.listen(port);
  return app;
}

export const createTestingServer = pipe(
  createTestingAppModule,
  (modBuilder: TestingModuleBuilder) => modBuilder.compile(),
  createTestingApp,
  startTestingServer,
);
export const createOverrideTestingServer = (
  overrideTestingModule: (
    modBuilder: TestingModuleBuilder,
  ) => TestingModuleBuilder | Promise<TestingModuleBuilder>,
) =>
  pipe(
    createTestingAppModule,
    overrideTestingModule,
    async (modBuilder: TestingModuleBuilder | Promise<TestingModuleBuilder>) =>
      (await modBuilder).compile(),
    createTestingApp,
    startTestingServer,
  );

export const withAPIServer = (
  testingAppServerCreator:
    | (() => Promise<INestApplication> | INestApplication)
    | Promise<INestApplication>
    | INestApplication,
) => {
  const context = {};
  beforeAll(async () => {
    if (typeof testingAppServerCreator === 'function') {
      const app = await testingAppServerCreator();
      Object.assign(context, { app });
    } else {
      const app = await testingAppServerCreator;
      Object.assign(context, { app });
    }
  });
  afterAll(async () => {
    await (context as NestServerContext)?.app?.close();
  });
  return context as NestServerContext;
};
