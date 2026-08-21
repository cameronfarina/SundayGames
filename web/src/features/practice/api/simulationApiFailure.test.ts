import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { runSimulations } from "./simulationApi";

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

describe("simulation API failure recovery", () => {
  it("does not retry a rejected completion and tolerates cancellation cleanup failure", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(response({
        historyId: "history-2",
        requestId: "request-2",
        input: { runCount: 2, seedPrefix: "simulation-api" },
        inputDigest: "digest-2",
      }, 202))
      .mockResolvedValueOnce(response({
        error: { code: "invalid_result", message: "Invalid result." },
      }, 422))
      .mockRejectedValueOnce(new Error("Cleanup unavailable."));
    let onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    const worker = {
      onerror: null,
      get onmessage() { return onmessage; },
      set onmessage(value: ((event: MessageEvent<unknown>) => void) | null) { onmessage = value; },
      postMessage: vi.fn(() => { queueMicrotask(() => {
        onmessage?.(new MessageEvent("message", {
          data: { result: { runCount: 2, seedPrefix: "simulation-api" }, type: "result" },
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
    })).rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({
      code: "invalid_result",
    }));
    await vi.waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(3); });
  });
});
