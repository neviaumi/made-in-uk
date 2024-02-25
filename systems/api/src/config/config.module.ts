import { Module } from '@nestjs/common';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';

import { configuration } from './configuration';
import { getEnvFilePath } from './getEnvFilePath';

export { ConfigService } from '@nestjs/config';

@Module({
  exports: [ConfigService],
  imports: [NestConfigModule],
  providers: [ConfigService],
})
export class ConfigModule {
  static forRoot() {
    return {
      exports: [ConfigService],
      imports: [
        NestConfigModule.forRoot({
          envFilePath: getEnvFilePath(),
          expandVariables: true,
          load: [
            async () => {
              return configuration();
            },
          ],
        }),
      ],
      module: ConfigModule,
      providers: [ConfigService],
    };
  }
}
