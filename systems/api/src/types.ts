import type { Config } from '@/config.ts';
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
  config: Config;
  logger: Logger;
  requestId: string;
};

export type ResolverFunction<
  Args = unknown,
  Context = GraphqlContext,
  PARENT = unknown,
> = (parent: PARENT, args: Args, context: Context) => any;
