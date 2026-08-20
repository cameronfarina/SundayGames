interface QueuedOperation {
  kind: "read" | "write";
  start(): void;
}

interface AsyncReadWriteLock {
  read<T>(operation: () => Promise<T>): Promise<T>;
  write<T>(operation: () => Promise<T>): Promise<T>;
}

export const createAsyncReadWriteLock = (): AsyncReadWriteLock => {
  let activeReaders = 0;
  let activeWriter = false;
  const queue: QueuedOperation[] = [];

  const drain = (): void => {
    if (activeWriter || activeReaders > 0) return;
    const first = queue.shift();
    if (first === undefined) return;
    first.start();
    if (first.kind === "write") return;

    while (queue[0]?.kind === "read") queue.shift()?.start();
  };

  const run = <T>(
    kind: QueuedOperation["kind"],
    operation: () => Promise<T>,
  ): Promise<T> => new Promise<T>((resolve, reject) => {
    const queued: QueuedOperation = {
      kind,
      start: () => {
        if (kind === "read") activeReaders += 1;
        else activeWriter = true;

        void Promise.resolve()
          .then(operation)
          .then(resolve, reject)
          .finally(() => {
            if (kind === "read") activeReaders -= 1;
            else activeWriter = false;
            drain();
          });
      },
    };
    const canStart = !activeWriter && queue.length === 0 &&
      (kind === "read" || activeReaders === 0);
    if (canStart) queued.start();
    else queue.push(queued);
  });

  return {
    read: operation => run("read", operation),
    write: operation => run("write", operation),
  };
};
