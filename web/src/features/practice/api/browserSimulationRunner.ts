import type { SimulationProgress } from "./simulationSchema";

export type BrowserSimulationInput = Readonly<Record<string, unknown>>;

interface BrowserSimulationWorkerMessage {
  readonly type: "progress" | "result" | "error";
  readonly progress?: SimulationProgress | undefined;
  readonly result?: unknown;
  readonly message?: string | undefined;
}

interface BrowserSimulationWorker {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<BrowserSimulationWorkerMessage>) => void) | null;
  postMessage(value: unknown): void;
  terminate(): void;
}

export type BrowserSimulationWorkerFactory = () => BrowserSimulationWorker;

const defaultWorkerFactory: BrowserSimulationWorkerFactory = () => new Worker(
  new URL("../workers/seasonSimulation.worker.ts", import.meta.url),
  { type: "module" },
);

interface RunBrowserSimulationOptions {
  readonly onProgress: (progress: SimulationProgress) => void;
  readonly signal?: AbortSignal | undefined;
  readonly workerFactory?: BrowserSimulationWorkerFactory | undefined;
}

const abortError = (): DOMException => new DOMException("Simulation canceled.", "AbortError");

export const runSimulationInBrowser = (
  input: BrowserSimulationInput,
  options: RunBrowserSimulationOptions,
): Promise<unknown> => new Promise((resolve, reject) => {
  const worker = (options.workerFactory ?? defaultWorkerFactory)();
  let settled = false;
  const finish = (operation: () => void): void => {
    if (settled) return;
    settled = true;
    options.signal?.removeEventListener("abort", cancel);
    worker.terminate();
    operation();
  };
  const cancel = (): void => {
    finish(() => { reject(abortError()); });
  };
  worker.onmessage = event => {
    const message = event.data;
    if (message.type === "progress" && message.progress !== undefined) {
      options.onProgress(message.progress);
    } else if (message.type === "result" && message.result !== undefined) {
      finish(() => { resolve(message.result); });
    } else if (message.type === "error") {
      finish(() => { reject(new Error(message.message ?? "Simulation failed.")); });
    }
  };
  worker.onerror = event => {
    finish(() => { reject(new Error(event.message || "Simulation failed.")); });
  };
  if (options.signal?.aborted === true) cancel();
  else {
    options.signal?.addEventListener("abort", cancel, { once: true });
    worker.postMessage({ input });
  }
});
