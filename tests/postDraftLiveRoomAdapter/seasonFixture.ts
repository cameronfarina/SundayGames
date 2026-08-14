import type { AuctionLeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../src/platform/liveDraftRooms.js";

export const leagueId = "league_sunday";
export const seasonId = "season_2026";

export const season = (): AuctionLeagueSeason => ({
  id: seasonId,
  league: {
    id: leagueId,
    externalLeagueId: "100001",
    name: "Sunday Games",
    provider: "espn",
  },
  leagueId,
  seasonYear: 2026,
  setupStatus: "published",
  teams: [
    {
      id: "team_cam",
      leagueSeasonId: seasonId,
      ownerId: "owner_cam",
      ownerDisplayName: "Owner11",
      displayName: "Short King",
      draftOrderPosition: 1,
    },
    {
      id: "team_sam",
      leagueSeasonId: seasonId,
      ownerId: "owner_sam",
      ownerDisplayName: "Owner12",
      displayName: "Massage Envy",
      draftOrderPosition: 2,
    },
    {
      id: "team_nick",
      leagueSeasonId: seasonId,
      ownerId: "owner_nick",
      ownerDisplayName: "Nick",
      displayName: "Nick Team",
      draftOrderPosition: 3,
    },
    {
      id: "team_seth",
      leagueSeasonId: seasonId,
      ownerId: "owner_seth",
      ownerDisplayName: "Owner04",
      displayName: "Owner04 Team",
      draftOrderPosition: 4,
    },
  ],
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
      lineup: { QB: 1, RB: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
    },
    keeperPolicy: {
      mode: "previous-cost-multiplier",
      multiplier: 1.2,
      rounding: "ceil",
    },
  },
});

export const catalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Owner11 Quarterback", position: "QB", expectedPrice: 20 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
  { name: "Owner12 Quarterback", position: "QB", expectedPrice: 8 },
  { name: "Owner12 Running Back", position: "RB", expectedPrice: 12 },
  { name: "Nick Quarterback", position: "QB", expectedPrice: 7 },
  { name: "Nick Running Back", position: "RB", expectedPrice: 11 },
  { name: "Owner04 Quarterback", position: "QB", expectedPrice: 6 },
  { name: "Owner04 Running Back", position: "RB", expectedPrice: 10 },
];
