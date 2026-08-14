import { expect, it } from "vitest";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerPlayerNameErrorTests = (): void => {
  it("rejects an ambiguous first name with a useful diagnostic", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: {
        ...auctionSetup,
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Josh Allen", position: "QB", expectedPrice: 25 },
          { name: "Josh Jacobs", position: "RB", expectedPrice: 25 },
        ],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "draft josh",
      seedPrefix: "ambiguous-first-name",
    });

    expect(result.strategy.warnings).toContain(
      "Target player josh matches multiple players; use the full name.",
    );
    expect(result.targetOutcome).toMatchObject({
      playerId: "josh",
      playerName: "josh",
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      reason: "ambiguous_player_name",
      message: "Target player josh matches multiple players; use the full name.",
    });
  });
};
