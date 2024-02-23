import { FieldValue } from '@google-cloud/firestore';
import { Injectable } from '@nestjs/common';

import { DatabaseConnection } from '../database/database.module';

@Injectable()
export class VisitCountService {
  constructor(private databaseConnection: DatabaseConnection) {}

  async incrementVisitCount() {
    const fireStore = this.databaseConnection.proxy();
    const count = await fireStore.collection('visit-count').doc('count').get();
    if (!count.exists) {
      await fireStore.collection('visit-count').doc('count').set({ count: 1 });
    } else {
      await fireStore
        .collection('visit-count')
        .doc('count')
        .update({ count: FieldValue.increment(1) });
    }
  }

  async getVisitCount() {
    const fireStore = this.databaseConnection.proxy();
    const count = await fireStore.collection('visit-count').doc('count').get();
    if (!count.exists) {
      return {
        count: 0,
      };
    }
    return {
      count: count.data()!['count'],
    };
  }
}
