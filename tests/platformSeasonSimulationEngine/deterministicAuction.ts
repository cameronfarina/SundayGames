import { expect, it } from "vitest";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerDeterministicAuctionTests = (): void => {
  it("completes deterministic auction runs with keepers, a price-capped target, and exposure", () => {
    const input = {
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
      seedPrefix: "auction-plan",
    };

    const result = runSeasonSimulations(input);

    expect(result).toMatchObject({
      draftFormat: "auction",
      runCount: 3,
      completedCount: 3,
      seedPrefix: "auction-plan",
      targetOutcome: {
        playerName: "Jadarian Price",
        hitCount: 3,
        hitRate: 1,
      },
      positionCounts: {
        RB: { total: 6, perRun: 2 },
      },
    });
    expect(result.playerExposure.find(player => player.playerName === "Jadarian Price"))
      .toMatchObject({ count: 3, rate: 1, averagePrice: expect.any(Number) });
    expect(result.playerExposure.find(player => player.playerName === "Jadarian Price")?.averagePrice)
      .toBeLessThanOrEqual(20);
    expect(result.strategy.warnings).not.toContain(
      "Pair-with player Achane was not found in the player catalog.",
    );
    expect(result.runs).toHaveLength(3);
    expect(result.runs[0]).toMatchObject({
      runNumber: 1,
      label: "Run 1",
      seed: "auction-plan:1",
    });
    expect(result.runs[0]?.teams).toHaveLength(4);
    expect(result.runs[0]?.teams.find(team => team.teamId === "team-1")).toMatchObject({
      teamName: "Owner11 Team",
      isUserTeam: true,
      roster: expect.arrayContaining([
        expect.objectContaining({
          playerName: "De'Von Achane",
          source: "keeper",
          week1Points: 18.5,
        }),
      ]),
    });
    expect(result.runs[0]?.teams.every(team => team.roster.length === 2)).toBe(true);
    expect(runSeasonSimulations(input)).toEqual(result);
  });
};
