import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import {
  loadSimulation,
  loadSimulationRun,
  runSimulations,
  setSimulationOutcomeFavorite,
} from "./simulationApi";

const summary = {
  completedCount: 2,
  draftFormat: "auction",
  outcomes: [],
  playerExposure: [],
  positionCounts: {},
  runCount: 2,
  seedPrefix: "simulation-api",
  strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
};

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

describe("simulation API", () => {
  it("does not launch when the caller signal is already aborted", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<PlatformFetch>();
    controller.abort();

    await expect(runSimulations({
      count: 2,
      fetcher,
      note: "",
      onProgress: vi.fn(),
      seasonId: "season-1",
      signal: controller.signal,
      strategy: "",
      strategyPreset: "balanced",
    })).rejects.toMatchObject({ name: "AbortError" });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads a compact summary and one selected run", async () => {
    const run = { label: "Run 2", runNumber: 2, seed: "two", teams: [] };
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(response({ historyId: "history / 1", summary }))
      .mockResolvedValueOnce(response({ historyId: "history / 1", run }));

    await expect(loadSimulation({ fetcher, historyId: "history / 1" }))
      .resolves.toMatchObject({ summary: { runCount: 2 } });
    await expect(loadSimulationRun({ fetcher, historyId: "history / 1", runNumber: 2 }))
      .resolves.toMatchObject({ run: { runNumber: 2 } });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      "/season-simulations/history%20%2F%201",
      "/season-simulations/history%20%2F%201/runs/2",
    ]);
  });

  it("saves an outcome to My Team", async () => {
    const outcome = { favorite: true, rank: 1, runNumber: 2, userWeek1Points: 112.5 };
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(response({
      historyId: "history / 1",
      outcome,
    }));

    await expect(setSimulationOutcomeFavorite({
      favorite: true,
      fetcher,
      historyId: "history / 1",
      runNumber: 2,
    })).resolves.toEqual({ historyId: "history / 1", outcome });
    expect(fetcher).toHaveBeenCalledWith(
      "/season-simulations/history%20%2F%201/runs/2",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("prepares, computes in a browser worker, and persists a compact result", async () => {
    const result = { historyId: "history-2", summary };
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(response({
        historyId: "history-2",
        requestId: "request-2",
        input: { runCount: 2, seedPrefix: "simulation-api" },
        inputDigest: "digest-2",
        note: "Compare builds",
      }, 202))
      .mockResolvedValueOnce(response(result));
    const onProgress = vi.fn();
    let onerror: ((event: ErrorEvent) => void) | null = null;
    let onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    const worker = {
      get onerror() { return onerror; },
      set onerror(value: ((event: ErrorEvent) => void) | null) { onerror = value; },
      get onmessage() { return onmessage; },
      set onmessage(value: ((event: MessageEvent<unknown>) => void) | null) { onmessage = value; },
      postMessage: vi.fn(() => { queueMicrotask(() => {
        onmessage?.(new MessageEvent("message", {
          data: { type: "progress", progress: { completed: 2, total: 2 } },
        }));
        onmessage?.(new MessageEvent("message", {
          data: { type: "result", result: { runCount: 2, seedPrefix: "simulation-api" } },
        }));
      }); }),
      terminate: vi.fn(),
    };

    await expect(runSimulations({
      count: 2,
      fetcher,
      note: "Compare builds",
      onProgress,
      seasonId: "season-1",
      strategy: "Draft Puka.",
      strategyPreset: "balanced",
      workerFactory: () => worker,
    })).resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledWith({ completed: 2, total: 2 });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      "/season-simulations",
      "/season-simulations/history-2/complete",
    ]);
    expect(fetcher.mock.calls[1]?.[1]?.body).toContain('"inputDigest":"digest-2"');
  });

  it("recovers a committed completion when its successful response is truncated", async () => {
    const result = { historyId: "history-2", summary };
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(response({
        historyId: "history-2",
        requestId: "request-2",
        input: { runCount: 2, seedPrefix: "simulation-api" },
        inputDigest: "digest-2",
      }, 202))
      .mockResolvedValueOnce(new Response("truncated", { status: 200 }))
      .mockResolvedValueOnce(response(result));
    let onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    const worker = {
      onerror: null,
      get onmessage() { return onmessage; },
      set onmessage(value: ((event: MessageEvent<unknown>) => void) | null) { onmessage = value; },
      postMessage: vi.fn(() => { queueMicrotask(() => {
        onmessage?.(new MessageEvent("message", {
          data: { type: "result", result: { runCount: 2, seedPrefix: "simulation-api" } },
        }));
      }); }),
      terminate: vi.fn(),
    };

    await expect(runSimulations({
      count: 2,
      fetcher,
      note: "",
      onProgress: vi.fn(),
      seasonId: "season-1",
      strategy: "",
      strategyPreset: "balanced",
      workerFactory: () => worker,
    })).resolves.toEqual(result);

    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      "/season-simulations",
      "/season-simulations/history-2/complete",
      "/season-simulations/history-2/complete",
    ]);
  });

  it("cancels the issued launch when the tab lifecycle aborts", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(response({
      historyId: "history-2",
      requestId: "request-2",
      input: { runCount: 2, seedPrefix: "simulation-api" },
      inputDigest: "digest-2",
    }, 202));
    const worker = {
      onerror: null,
      onmessage: null,
      postMessage: vi.fn(() => { controller.abort(); }),
      terminate: vi.fn(),
    };

    await expect(runSimulations({
      count: 2,
      fetcher,
      note: "",
      onProgress: vi.fn(),
      seasonId: "season-1",
      signal: controller.signal,
      strategy: "",
      strategyPreset: "balanced",
      workerFactory: () => worker,
    })).rejects.toMatchObject({ name: "AbortError" });

    expect(fetcher).toHaveBeenCalledWith(
      "/season-simulations/history-2",
      expect.objectContaining({ keepalive: true, method: "DELETE" }),
    );
  });

  it("cancels by client request ID when the tab closes before the launch response", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<PlatformFetch>((_path, init) => {
      if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Simulation canceled.", "AbortError"));
        }, { once: true });
      });
    });
    const execution = runSimulations({
      count: 2,
      fetcher,
      note: "",
      onProgress: vi.fn(),
      seasonId: "season-1",
      signal: controller.signal,
      strategy: "",
      strategyPreset: "balanced",
    });
    controller.abort();

    await expect(execution).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher.mock.calls[1]?.[0]).toMatch(
      /^\/season-simulations\/requests\/[^?]+\?seasonId=season-1$/u,
    );
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ keepalive: true, method: "DELETE" });
  });

  it("preserves platform errors before a stream starts", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(response({
      error: { code: "rate_limited", message: "Try later." },
    }, 429));
    await expect(runSimulations({
      count: 2,
      fetcher,
      note: "",
      onProgress: vi.fn(),
      seasonId: "season-1",
      strategy: "",
      strategyPreset: "balanced",
    })).rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({ code: "rate_limited" }));
  });

});
