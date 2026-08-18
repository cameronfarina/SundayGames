import type { LiveDraftRoomPlayerCatalogEntry } from "../../src/platform/liveDraftRooms.js";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import {
  runSeasonSimulations,
  type SeasonSimulationTargetConstraint,
} from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const catalogPlayer = (
  player: LiveDraftRoomPlayerCatalogEntry,
): LiveDraftRoomPlayerCatalogEntry => player;

export const runTargetBudgetAuctionPlan = (
  targetConstraints: readonly SeasonSimulationTargetConstraint[],
  seedPrefix: string,
  // 150 keeps the 40% single-bid cap ($60) above the $57 elite, the same
  // shape as the real league's $80 cap over its $70 elites.
  budgetDollars = 150,
) => {
  const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
    ...auctionSeason,
    settings: {
      ...auctionSeason.settings,
      auction: { budgetDollars, minimumBidDollars: 1 },
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
    playerCatalog: [
      { name: "Premium Runner", position: "RB", expectedPrice: 57 },
      { name: "Value Runner", position: "RB", expectedPrice: 38 },
      ...Array.from(
        { length: 6 },
        (_, index): LiveDraftRoomSetup["playerCatalog"][number] => ({
          name: `Depth Runner ${index + 1}`,
          position: "RB",
          expectedPrice: 1,
        }),
      ),
    ],
  };

  return runSeasonSimulations({
    season,
    setup,
    humanTeamId: "team-1",
    runCount: 1,
    targetConstraints,
    seedPrefix,
  });
};
