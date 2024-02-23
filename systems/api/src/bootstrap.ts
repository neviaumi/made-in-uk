import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
// import { ConfigService } from './config/config.module';
import { configuration } from './config/configuration';
import { NestLogger } from './logging/nest-logger';

export async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  return setupApp(app);
}

export function setupApp(app: NestExpressApplication) {
  const logger = app.get(NestLogger);
  app.useLogger(logger);
  app.use(helmet({}));

  app.enableShutdownHooks();

  logger.debug({
    config: configuration(),
    level: 'debug',
    message: 'Starting server',
  });
  return app;
}
