export async function* combine<T>(...args: AsyncGenerator<T>[]) {
  let done = false;
  while (!done) {
    done = true;
    const generatedResult = await Promise.all(
      args.map(iterator => iterator.next()),
    );
    for (const { done: iteratorDone, value } of generatedResult) {
      if (!iteratorDone) {
        done = false; // If any generator still has values, continue the loop
        yield value;
      }
    }
  }
}
