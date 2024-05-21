import type { Config } from '@/config.ts';
import type { Logger } from '@/logging/logger.ts';

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
