import { expect, it } from "vitest";
import {
  runSeasonSimulations,
  SeasonSimulationError,
} from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup, snakeSetup } from "./draftSetups.js";
import { auctionSeason, snakeSeason } from "./leagueFixtures.js";

export const registerValidationTests = (): void => {
  it("returns typed boundary errors for invalid counts, claims, and setup configuration", () => {
    const baseInput = {
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      strategyInput: "",
    };

    for (const runCount of [0, 1.5, 26]) {
      expect(() => runSeasonSimulations({ ...baseInput, runCount }))
        .toThrow(new SeasonSimulationError(
          "invalid_run_count",
          "Simulation run count must be a whole number from 1 through 25.",
        ));
    }
    expect(runSeasonSimulations({ ...baseInput, runCount: 25 }).runs).toHaveLength(25);
    expect(() => runSeasonSimulations({ ...baseInput, humanTeamId: "missing", runCount: 1 }))
      .toThrowError(expect.objectContaining({ code: "human_team_missing" }));
    expect(() => runSeasonSimulations({
      ...baseInput,
      setup: { ...auctionSetup, seasonId: "another-season" },
      runCount: 1,
    })).toThrowError(expect.objectContaining({ code: "invalid_configuration" }));
  });

  it("warns when a parsed constraint belongs to the other draft format", () => {
    const auctionResult = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Jadarian Price by round 2",
    });
    const snakeResult = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Target Receiver for no more than $12",
    });

    expect(auctionResult.strategy.warnings).toContain(
      "Round and pick deadlines do not apply to auction simulations; the player target was still prioritized.",
    );
    expect(snakeResult.strategy.warnings).toContain(
      "Auction price limits do not apply to snake simulations; the player target was still prioritized.",
    );
  });

  it("reports an unresolved target with a zero hit rate instead of pretending it was honored", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Target Missing Player",
    });

    expect(result.targetOutcome).toEqual({
      playerId: "missing player",
      playerName: "Missing Player",
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      reason: "player_not_found",
      message: "Target player Missing Player was not found in the player catalog.",
    });
    expect(result.strategy.warnings).toContain(
      "Target player Missing Player was not found in the player catalog.",
    );
  });
};
