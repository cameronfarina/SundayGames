import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";
import { catalogPlayer } from "./simulationFixtures.js";

export const registerAuctionNominationTests = (): void => {
  it("keeps a named target affordable when an AI team nominates before the user", () => {
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
    const playerNames = [
      "Alpha Runner",
      "Beta Runner",
      "Gamma Runner",
      "Delta Runner",
      "Epsilon Runner",
      "Zeta Runner",
      "Eta Runner",
      "Theta Runner",
    ];
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [],
      playerCatalog: playerNames.map((name, index) => catalogPlayer({
        name,
        position: "RB",
        expectedPrice: 10 - index,
      })),
    };
    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-2",
      runCount: 1,
      strategyInput: "draft Alpha Runner for no more than $20",
      seedPrefix: "ai-before-human",
    });

    expect(result.targetOutcome).toMatchObject({ hitCount: 1, hitRate: 1 });
    expect(result.runs[0]?.teams.filter(team => !team.isUserTeam)
      .every(team => team.budgetRemaining
        === 100 - team.roster.reduce((total, player) => total + (player.price ?? 0), 0)))
      .toBe(true);

    const overCapacityTargets = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-2",
      runCount: 1,
      strategyInput: playerNames
        .map(name => `draft ${name} for no more than $20`)
        .join(". "),
      seedPrefix: "over-capacity-targets",
    });
    expect(overCapacityTargets.runs[0]?.teams.filter(team => !team.isUserTeam)
      .every(team => team.budgetRemaining
        === 100 - team.roster.reduce((total, player) => total + (player.price ?? 0), 0)))
      .toBe(true);
  });
};
