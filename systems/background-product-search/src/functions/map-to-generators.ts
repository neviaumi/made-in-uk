export const SKIP = Symbol('MAP_TO_GENERATOR_SKIP');

type SyncOrAsync<Result> = Promise<Result> | Result;

function mapToGeneratorWithTwoParameters<Result = unknown, Item = unknown>(
  mapper: (item: Item) => SyncOrAsync<Result | typeof SKIP>,
  items: Item[],
) {
  return mapToGeneratorWithOneParameters(mapper)(items);
}

function mapToGeneratorWithOneParameters<Result = unknown, Item = unknown>(
  mapper: (item: Item) => SyncOrAsync<Result | typeof SKIP>,
) {
  return async function* generator(items: Item[]) {
    for (const item of items) {
      const result = await mapper(item);
      if (result === SKIP) continue;
      yield result;
    }
  };
}

export const mapToGenerator = mapToGeneratorWithTwoParameters;
