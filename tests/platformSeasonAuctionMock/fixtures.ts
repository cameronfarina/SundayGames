import type { Position } from "../../config/league.js";
import type { ExplicitLeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";

export const season: ExplicitLeagueSeason = {
  id: "auction-season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Sunday", provider: "espn" },
  seasonYear: 2026,
  setupStatus: "published",
  teams: ["Owner11", "Owner12", "Matt", "Nick"].map((name, index) => ({
    id: `team-${index + 1}`,
    leagueSeasonId: "auction-season-2026",
    ownerId: `owner-${index + 1}`,
    ownerDisplayName: name,
    displayName: `${name} Team`,
    draftOrderPosition: index + 1,
  })),
  settings: {
    expectedTeamCount: 4,
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
    auction: { budgetDollars: 200, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { BENCH: 2 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

const positions: readonly Position[] = ["RB", "WR", "TE", "QB", "RB", "WR", "TE", "QB"];

export const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "test",
  playerCatalog: positions.map((position, index) => ({
    name: `Player ${index + 1}`,
    position,
    expectedPrice: 50 - index,
    teamAbbreviation: index === 0 ? "DET" : undefined,
    byeWeek: index === 0 ? 8 : undefined,
    week1Projection: 20 - index,
  })),
  initialRosters: [{
    teamId: "team-2",
    playerId: "player 2",
    playerName: "Player 2",
    position: "WR",
    price: 25,
    source: "keeper",
  }],
  contentHash: "hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};
