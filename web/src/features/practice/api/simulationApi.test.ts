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

  it("streams determinate progress before returning a compact result", async () => {
    const result = { historyId: "history-2", summary };
    const stream = [
      'event: progress\ndata: {"completed":1,"total":2}\n\n',
      'event: progress\ndata: {"completed":2,"total":2}\n\n',
      `event: result\ndata: ${JSON.stringify(result)}\n\n`,
    ].join("");
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(new Response(stream));
    const onProgress = vi.fn();

    await expect(runSimulations({
      count: 2,
      fetcher,
      note: "Compare builds",
      onProgress,
      seasonId: "season-1",
      strategy: "Draft Puka.",
      strategyPreset: "balanced",
    })).resolves.toEqual(result);
    expect(onProgress.mock.calls).toEqual([
      [{ completed: 1, total: 2 }],
      [{ completed: 2, total: 2 }],
    ]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("accept")).toBe("text/event-stream");
  });

  it("forwards cancellation to the simulation stream request", async () => {
    const controller = new AbortController();
    const result = { historyId: "history-2", summary };
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(new Response(
      `event: result\ndata: ${JSON.stringify(result)}\n\n`,
    ));

    await runSimulations({
      count: 2,
      fetcher,
      note: "",
      onProgress: vi.fn(),
      seasonId: "season-1",
      signal: controller.signal,
      strategy: "",
      strategyPreset: "balanced",
    });

    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
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
