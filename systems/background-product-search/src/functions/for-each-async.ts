function forEachAsyncWithTwoParameters<Item = unknown>(
  mapper: (item: Item) => Promise<void>,
  items: Item[],
) {
  return forEachAsyncWithOneParameters(mapper)(items);
}

function forEachAsyncWithOneParameters<Item = unknown>(
  mapper: (item: Item) => Promise<void>,
) {
  return async (items: Item[]) => {
    for (const item of items) {
      await mapper(item);
    }
  };
}

export const forEachAsync = forEachAsyncWithTwoParameters;
