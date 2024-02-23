import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { VisitCountResolver } from './visit-count.resolver';
import { VisitCountService } from './visit-count.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [VisitCountService, VisitCountResolver],
})
export class VisitCountModule {}
