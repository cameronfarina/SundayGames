import { describe, expect, it, vi } from "vitest";
import {
  snakePlayerCatalog,
  snakeSeason,
} from "../../../../../tests/platformHttp/support/fixtures";
import {
  handleSeasonSimulationWorkerMessage,
  simulationWorkerErrorMessage,
} from "./seasonSimulation.worker";

describe("season simulation worker protocol", () => {
  it("posts progress and the exact engine result", () => {
    const season = snakeSeason();
    if (season.settings.draftFormat !== "snake") throw new Error("Expected snake season.");
    const postMessage = vi.fn();

    handleSeasonSimulationWorkerMessage({
      input: {
        season,
        setup: {
          seasonId: season.id,
          sourceVersion: "worker-protocol",
          playerCatalog: snakePlayerCatalog,
          initialRosters: [],
          contentHash: "worker-protocol",
          updatedAt: new Date("2026-08-21T00:00:00.000Z"),
        },
        humanTeamId: season.teams[0]?.id ?? "missing-team",
        runCount: 1,
        seedPrefix: "worker-protocol",
      },
    }, postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: "progress",
      progress: { completed: 1, total: 1 },
    });
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "result",
      result: expect.objectContaining({ runCount: 1, seedPrefix: "worker-protocol" }),
    });
  });

  it.each([null, "missing", {}])("posts a safe error for malformed input %#", value => {
    const postMessage = vi.fn();

    handleSeasonSimulationWorkerMessage(value, postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: "error",
      message: "Browser simulation input is missing.",
    });
  });

  it("uses a safe fallback for a non-Error failure", () => {
    expect(simulationWorkerErrorMessage("private failure detail")).toBe("Simulation failed.");
  });

  it("registers the worker-global message adapter", () => {
    const postMessage = vi.spyOn(globalThis, "postMessage").mockImplementation(() => undefined);

    globalThis.onmessage?.(new MessageEvent("message", { data: {} }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "error",
      message: "Browser simulation input is missing.",
    });
    postMessage.mockRestore();
  });
});
