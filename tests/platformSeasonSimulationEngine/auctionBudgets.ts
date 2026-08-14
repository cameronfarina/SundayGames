import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason, teams } from "./leagueFixtures.js";
import { catalogPlayer } from "./simulationFixtures.js";

export const registerAuctionBudgetTests = (): void => {
  it("closes feasible low-value auction budgets while preserving explicit caps", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 2,
          lineup: { RB: 2 },
          lineupSlotCount: 2,
          rosterMaximums: { QB: 0, RB: 2, WR: 0, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [],
      playerCatalog: Array.from({ length: 8 }, (_, index) => catalogPlayer({
        name: `Low Value Runner ${index + 1}`,
        position: "RB",
        expectedPrice: 1,
      })),
    };
    for (const humanTeamId of teams.map(team => team.id)) {
      const result = runSeasonSimulations({
        season,
        setup,
        humanTeamId,
        runCount: 1,
        seedPrefix: `human-closing-budget-${humanTeamId}`,
      });
      for (const team of result.runs[0]?.teams ?? []) {
        expect(
          team.budgetRemaining,
          `${team.teamName} retained budget after a feasible low-value run: ${JSON.stringify(team.roster)}`,
        ).toBeLessThanOrEqual(1);
      }
    }

    const capped = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Do not spend over $10 on another RB",
      seedPrefix: "human-closing-budget-capped",
    });
    const humanRoster = capped.runs[0]?.teams.find(team => team.teamId === "team-1")?.roster ?? [];
    expect(humanRoster.every(player => (player.price ?? 0) <= 10)).toBe(true);
  });
};
