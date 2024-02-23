import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module';
import { SeederController } from './seeder.controller';
import { SeederService } from './seeder.service';

@Module({
  controllers: [SeederController],
  imports: [ConfigModule],
  providers: [SeederService],
})
export class SeederModule {}
