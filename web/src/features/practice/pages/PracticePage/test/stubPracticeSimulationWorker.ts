import { vi } from "vitest";

class PracticeSimulationWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(): void {
    queueMicrotask(() => {
      this.onmessage?.(new MessageEvent("message", {
        data: {
          result: { runCount: 2, seedPrefix: "practice-page" },
          type: "result",
        },
      }));
    });
  }

  terminate = vi.fn();
}

export const stubPracticeSimulationWorker = (): void => {
  vi.stubGlobal("Worker", PracticeSimulationWorker);
};
