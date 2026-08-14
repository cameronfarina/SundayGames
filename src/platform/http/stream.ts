export const eventStreamChunk = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const asyncTextStream = (
  execute: (emit: (chunk: string) => void) => void | Promise<void>,
): AsyncIterable<string> => {
  const chunks: string[] = [];
  let wake: (() => void) | undefined;
  let finished = false;
  const emit = (chunk: string): void => {
    chunks.push(chunk);
    wake?.();
    wake = undefined;
  };
  void Promise.resolve().then(() => execute(emit)).finally(() => {
    finished = true;
    wake?.();
    wake = undefined;
  });

  return {
    async *[Symbol.asyncIterator]() {
      while (!finished || chunks.length > 0) {
        if (chunks.length === 0) {
          await new Promise<void>(resolve => { wake = resolve; });
          continue;
        }
        const chunk = chunks.shift();
        if (chunk !== undefined) yield chunk;
      }
    },
  };
};
