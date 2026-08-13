export const createAsyncValueCache = <Value>(
  load: () => Promise<Value>,
): (() => Promise<Value>) => {
  let cached: Promise<Value> | undefined;

  return () => {
    if (cached === undefined) {
      cached = load().catch(error => {
        cached = undefined;
        throw error;
      });
    }

    return cached;
  };
};
