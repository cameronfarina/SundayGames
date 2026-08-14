export const serializeAsyncOperations = () => {
  let chain = Promise.resolve();

  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const result = chain.then(operation, operation);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
};
