import { Firestore } from '@google-cloud/firestore';
import { Injectable, Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '../config/config.module';

@Injectable()
export class DatabaseConnection {
  private readonly store: Firestore;

  constructor(private config: ConfigService) {
    const storeConfig = {
      databaseId: this.config.getOrThrow('database.id'),
    };
    this.store = new Firestore(storeConfig);
  }

  proxy() {
    return this.store;
  }
}

@Module({
  exports: [DatabaseConnection],
  imports: [ConfigModule],
  providers: [DatabaseConnection],
})
export class DatabaseModule {}
