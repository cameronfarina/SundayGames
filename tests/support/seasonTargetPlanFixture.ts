import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
} from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import {
  runSeasonSimulations,
  type SeasonSimulationTargetConstraint,
} from "../../src/platform/seasonSimulationEngine.js";

const teams = Array.from({ length: 4 }, (_, index) => ({
  id: `team-${index + 1}`,
  leagueSeasonId: "target-plan-season",
  ownerId: `manager-${index + 1}`,
  ownerDisplayName: `Manager ${index + 1}`,
  displayName: `Team ${index + 1}`,
  draftOrderPosition: index + 1,
}));

const seasonFor = (budgetDollars: number): LeagueSeason<AuctionLeagueSeasonSettings> => ({
  id: "target-plan-season",
  leagueId: "target-plan-league",
  league: {
    id: "target-plan-league",
    externalLeagueId: "100001",
    name: "Target Plan League",
    provider: "espn",
  },
  seasonYear: 2026,
  setupStatus: "published",
  teams,
  settings: {
    expectedTeamCount: teams.length,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    auction: { budgetDollars, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { RB: 2 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 0, RB: 2, WR: 0, TE: 0, K: 0, DST: 0 },
    },
    keeperPolicy: {
      mode: "previous-cost-multiplier",
      multiplier: 1.2,
      rounding: "ceil",
    },
  },
});

const setup: LiveDraftRoomSetup = {
  seasonId: "target-plan-season",
  sourceVersion: "target-plan-test",
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
  initialRosters: [],
  contentHash: "target-plan-fixture",
  updatedAt: new Date("2026-08-14T12:00:00.000Z"),
};

export const runTargetPlanFixture = (input: {
  targets: readonly SeasonSimulationTargetConstraint[];
  budgetDollars?: number | undefined;
  runCount?: number | undefined;
  seedPrefix?: string | undefined;
}) => runSeasonSimulations({
  season: seasonFor(input.budgetDollars ?? 100),
  setup,
  humanTeamId: "team-1",
  runCount: input.runCount ?? 1,
  targetConstraints: input.targets,
  seedPrefix: input.seedPrefix ?? "target-plan-regression",
});
