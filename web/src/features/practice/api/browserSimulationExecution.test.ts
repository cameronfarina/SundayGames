import { describe, expect, it, vi } from "vitest";
import { runSeasonSimulations } from
  "../../../../../src/platform/seasonSimulationEngine/orchestrator";
import {
  snakePlayerCatalog,
  snakeSeason,
} from "../../../../../tests/platformHttp/support/fixtures";
import { executeBrowserSimulation } from "./browserSimulationExecution";

describe("browser simulation execution", () => {
  it("runs the exact shared seeded engine and forwards progress", () => {
    const season = snakeSeason();
    if (season.settings.draftFormat !== "snake") throw new Error("Expected snake season.");
    const input = {
      season,
      setup: {
        seasonId: season.id,
        sourceVersion: "browser-execution",
        playerCatalog: snakePlayerCatalog,
        initialRosters: [],
        contentHash: "browser-execution",
        updatedAt: new Date("2026-08-21T00:00:00.000Z"),
      },
      humanTeamId: season.teams[0]?.id ?? "missing-team",
      runCount: 1,
      seedPrefix: "browser-execution",
    };
    const onProgress = vi.fn();

    expect(executeBrowserSimulation(input, onProgress))
      .toEqual(runSeasonSimulations(input, { onProgress: vi.fn() }));
    expect(onProgress).toHaveBeenCalledWith({ completed: 1, total: 1 });
  });
});
