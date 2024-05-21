import { isPromise } from 'node:util/types';

import { pipeWith } from 'ramda';

export const pipeAsync = pipeWith((next, result) => {
  return isPromise(result) ? result.then(next) : next(result);
});
