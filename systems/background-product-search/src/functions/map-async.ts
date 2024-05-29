import { isPromise } from 'node:util/types';

import { pipeWith } from 'ramda';

export const MAP_SKIP = Symbol('MAP_SKIP');

function mapAsyncWithTwoParameters<Result = unknown, Item = unknown>(
  mapper: (item: Item) => Result,
  items: Item[],
) {
  return mapAsyncWithOneParameters(mapper)(items);
}

function mapAsyncWithOneParameters<Result = unknown, Item = unknown>(
  mapper: (item: Item) => Result,
) {
  return async (items: Item[]): Promise<Result[]> => {
    const results: Result[] = [];
    const lastResult = await pipeWith((next, result) => {
      if (isPromise(result))
        return result.then(resolved => {
          if (resolved === MAP_SKIP) return next(resolved);
          results.push(resolved as Result);
          return next(resolved);
        });
      if (result === MAP_SKIP) return next(result);
      results.push(result);
      return next(result);
    })(
      // @ts-expect-error - This is a valid use case for reduce
      items.map(item => () => mapper(item)),
    )();
    if (lastResult !== MAP_SKIP) results.push(lastResult as Result);
    return results;
  };
}

export const mapAsync = mapAsyncWithTwoParameters;
