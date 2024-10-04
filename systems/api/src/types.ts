import type { Logger } from '@/logger.ts';

export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  pricePerItem: string | null;
  title: string;
  type: string;
  url: string;
};

export type GraphqlContext = {
  logger: Logger;
  operationName: string;
  requestId: string;
  userId: string;
};

export type ResolverFunction<
  Args = unknown,
  Context = GraphqlContext,
  PARENT = unknown,
> = (parent: PARENT, args: Args, context: Context) => any;
