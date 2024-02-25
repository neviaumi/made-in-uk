import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class VisitCount {
  @Field()
  count!: number;
}
