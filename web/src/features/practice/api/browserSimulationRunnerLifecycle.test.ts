import { describe, expect, it, vi } from "vitest";
import { runSimulationInBrowser } from "./browserSimulationRunner";

const input = { runCount: 2 };

class FakeWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();
}

describe("browser simulation worker lifecycle", () => {
  it("forwards worker progress and resolves its result", async () => {
    const worker = new FakeWorker();
    const onProgress = vi.fn();
    const completion = runSimulationInBrowser(input, {
      onProgress,
      workerFactory: () => worker,
    });

    expect(worker.postMessage).toHaveBeenCalledWith({ input });
    worker.onmessage?.(new MessageEvent("message", {
      data: { type: "progress", progress: { completed: 1, total: 2 } },
    }));
    const result = { runCount: 2, seedPrefix: "browser" };
    worker.onmessage?.(new MessageEvent("message", { data: { type: "result", result } }));

    await expect(completion).resolves.toBe(result);
    expect(onProgress).toHaveBeenCalledWith({ completed: 1, total: 2 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the worker when the tab lifecycle aborts", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const completion = runSimulationInBrowser(input, {
      onProgress: vi.fn(),
      signal: controller.signal,
      workerFactory: () => worker,
    });

    controller.abort();

    await expect(completion).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("does not start work for an already-aborted launch", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    controller.abort();

    await expect(runSimulationInBrowser(input, {
      onProgress: vi.fn(),
      signal: controller.signal,
      workerFactory: () => worker,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects a worker-reported simulation error and ignores later messages", async () => {
    const worker = new FakeWorker();
    const completion = runSimulationInBrowser(input, {
      onProgress: vi.fn(),
      workerFactory: () => worker,
    });

    worker.onmessage?.(new MessageEvent("message", {
      data: { message: "Invalid prepared input.", type: "error" },
    }));
    worker.onmessage?.(new MessageEvent("message", {
      data: { result: { runCount: 2 }, type: "result" },
    }));

    await expect(completion).rejects.toThrow("Invalid prepared input.");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("uses a safe fallback for an unmessaged worker runtime error", async () => {
    const worker = new FakeWorker();
    const completion = runSimulationInBrowser(input, {
      onProgress: vi.fn(),
      workerFactory: () => worker,
    });

    worker.onerror?.(new ErrorEvent("error"));

    await expect(completion).rejects.toThrow("Simulation failed.");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("uses a safe fallback for an unmessaged simulation error", async () => {
    const worker = new FakeWorker();
    const completion = runSimulationInBrowser(input, {
      onProgress: vi.fn(),
      workerFactory: () => worker,
    });

    worker.onmessage?.(new MessageEvent("message", { data: { type: "error" } }));

    await expect(completion).rejects.toThrow("Simulation failed.");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("ignores an unknown worker message until the launch is canceled", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const completion = runSimulationInBrowser(input, {
      onProgress: vi.fn(),
      signal: controller.signal,
      workerFactory: () => worker,
    });

    worker.onmessage?.(new MessageEvent("message", { data: { type: "unknown" } }));
    controller.abort();

    await expect(completion).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
