import type { ActivePlatformHttpStreamRegistry } from "./contracts.js";

interface ActiveStream {
  abort: () => void;
  completed: Promise<void>;
}

export class PlatformHttpActiveStreamRegistry implements ActivePlatformHttpStreamRegistry {
  readonly #active = new Map<symbol, ActiveStream>();
  #closing = false;

  async run(input: { abort: () => void; write: () => Promise<void> }): Promise<void> {
    const id = Symbol("platform-http-stream");
    let complete!: () => void;
    const completed = new Promise<void>(resolve => {
      complete = resolve;
    });
    this.#active.set(id, { abort: input.abort, completed });
    if (this.#closing) input.abort();

    try {
      await input.write();
    } finally {
      this.#active.delete(id);
      complete();
    }
  }

  async abortAndDrain(): Promise<void> {
    this.#closing = true;
    while (this.#active.size > 0) {
      const active = [...this.#active.values()];
      for (const stream of active) stream.abort();
      await Promise.all(active.map(stream => stream.completed));
    }
  }
}
