import { Mutation, Query, Resolver } from '@nestjs/graphql';

import { VisitCount } from './visit-count.model';
import { VisitCountService } from './visit-count.service';

@Resolver(() => VisitCount)
export class VisitCountResolver {
  constructor(private visitCountService: VisitCountService) {}

  @Query(() => VisitCount)
  async visitCount(): Promise<VisitCount> {
    const { count } = await this.visitCountService.getVisitCount();
    return { count };
  }

  @Mutation(() => VisitCount)
  async incrementVisitCount() {
    await this.visitCountService.incrementVisitCount();
    return {
      count: 0,
    };
  }
}
