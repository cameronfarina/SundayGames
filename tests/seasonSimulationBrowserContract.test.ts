import { describe, expect, it } from "vitest";
import {
  assertBrowserSeasonSimulationResult,
  maximumSeasonSimulationRunCount,
} from "../src/platform/seasonSimulationEngine.js";
import { snakePlayerCatalog, snakeSeason } from "./platformHttp/support/fixtures.js";
import { runSeasonSimulations } from "../src/platform/seasonSimulationEngine.js";
import type { ExplicitLeagueSeason } from "../src/platform/leagueSeason.js";

const season = snakeSeason() as ExplicitLeagueSeason;
const input = {
  season,
  setup: {
    seasonId: season.id,
    sourceVersion: "browser-contract",
    playerCatalog: snakePlayerCatalog,
    initialRosters: [],
    contentHash: "browser-contract",
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
  },
  humanTeamId: season.teams[0]?.id ?? "missing-team",
  runCount: 2,
  seedPrefix: "browser-parity",
};

describe("browser season simulation contract", () => {
  it("uses the product limit of 25 simulations per launch", () => {
    expect(maximumSeasonSimulationRunCount).toBe(25);
  });

  it("accepts exact seeded engine output and rejects results outside the issued launch", () => {
    const result = runSeasonSimulations(input);

    expect(assertBrowserSeasonSimulationResult(result, {
      runCount: input.runCount,
      seedPrefix: input.seedPrefix,
    })).toEqual(result);
    expect(() => assertBrowserSeasonSimulationResult(
      { ...result, runCount: 25 },
      { runCount: input.runCount, seedPrefix: input.seedPrefix },
    )).toThrow(/run count/i);
    expect(() => assertBrowserSeasonSimulationResult(
      { ...result, padding: "x".repeat(2_100_000) },
      { runCount: input.runCount, seedPrefix: input.seedPrefix },
    )).toThrow(/too large/i);
    const firstRun = result.runs[0];
    if (firstRun === undefined) throw new Error("Expected seeded result run.");
    const firstTeam = firstRun.teams[0];
    if (firstTeam === undefined) throw new Error("Expected seeded result team.");
    expect(() => assertBrowserSeasonSimulationResult({
      ...result,
      runs: [{ ...firstRun, teams: [...firstRun.teams, firstTeam] }],
      runCount: 1,
      completedCount: 1,
    }, {
      runCount: 1,
      seedPrefix: input.seedPrefix,
    })).toThrow(/duplicate teams/i);
  });
});
