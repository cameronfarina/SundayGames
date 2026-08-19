import { liveDraftAdvisorySchema } from "../api/liveDraftAdvisorySchemas";
import {
  liveDraftRoomSchema,
  liveDraftTeamSchema,
} from "../api/liveDraftSchemas";

export const liveTeam = liveDraftTeamSchema.parse({
  teamId: "team-1",
  ownerId: "owner-1",
  ownerDisplayName: "Owner11",
  teamDisplayName: "Short King",
  draftOrderPosition: 1,
  budgetDollars: 200,
  spent: 50,
  budgetRemaining: 150,
  rosterSlotsRemaining: 1,
  maxBid: 150,
  positionCounts: { QB: 0, RB: 1, WR: 0, TE: 0, K: 0, DST: 0 },
  roster: [{
    name: "De'Von Achane",
    normalizedPlayerName: "devon achane",
    position: "RB",
    price: 50,
    expectedPrice: 60,
    source: "keeper",
    teamAbbreviation: "MIA",
    byeWeek: 6,
  }],
  slots: [
    { slot: "RB1", player: {
      name: "De'Von Achane",
      normalizedPlayerName: "devon achane",
      position: "RB",
      price: 50,
      expectedPrice: 60,
      source: "keeper",
      teamAbbreviation: "MIA",
      byeWeek: 6,
    } },
    { slot: "WR1" },
  ],
});

export const otherTeam = liveDraftTeamSchema.parse({
  ...liveTeam,
  teamId: "team-2",
  ownerId: "owner-2",
  ownerDisplayName: "Owner04",
  teamDisplayName: "Sentinels",
  draftOrderPosition: 2,
  spent: 0,
  budgetRemaining: 200,
  maxBid: 199,
  rosterSlotsRemaining: 2,
  roster: [],
  slots: [{ slot: "RB1" }, { slot: "WR1" }],
});

export const liveRoom = liveDraftRoomSchema.parse({
  roomId: "room-1",
  leagueId: "league-1",
  seasonId: "season-1",
  status: "live",
  revision: 2,
  updatedAt: "2026-08-13T18:00:00.000Z",
  role: "commissioner",
  canMutateRoom: true,
  canExportDraft: true,
  board: [{
    name: "Puka Nacua",
    normalizedPlayerName: "puka nacua",
    position: "WR",
    expectedPrice: 72,
    marketPrice: 68,
    teamAbbreviation: "LAR",
    byeWeek: 8,
  }],
  selectedTeam: liveTeam,
  viewedTeam: liveTeam,
  teamSummaries: [liveTeam, otherTeam],
  salesLog: [{
    saleEventId: "sale-1",
    revision: 2,
    occurredAt: "2026-08-13T18:00:00.000Z",
    teamId: "team-1",
    ownerId: "owner-1",
    ownerDisplayName: "Owner11",
    teamDisplayName: "Short King",
    playerName: "De'Von Achane",
    position: "RB",
    price: 50,
    expectedPrice: 60,
    teamAbbreviation: "MIA",
    byeWeek: 6,
  }],
  connection: {
    state: "synchronized",
    transport: "sse",
    cursor: "room-1:2",
    revision: 2,
    retryMilliseconds: 5000,
    pollingFallback: true,
  },
  exportReadiness: {
    status: "pending",
    blockers: ["Draft room must be ended before final export."],
  },
});

// Rest-of-season is the basis a real room serves, and those ranks belong to no
// single week, so the week is null exactly as production sends it.
export const liveAdvisory = liveDraftAdvisorySchema.parse({
  configured: true,
  basis: "ros",
  week: null,
  players: [{
    normalizedPlayerName: "puka nacua",
    rankEcr: 3,
    tier: 1,
    positionRank: "WR2",
    momentum: "rising",
    ecrDelta: 4,
  }],
});

export const nacuaInjury = {
  headline: "Nacua is questionable with a knee injury",
  publishedAt: "2026-09-17T08:30:00.000Z",
};

export const injuredAdvisory = liveDraftAdvisorySchema.parse({
  ...liveAdvisory,
  players: liveAdvisory.players.map(player => ({ ...player, injury: nacuaInjury })),
});

export const darkAdvisory = liveDraftAdvisorySchema.parse({
  configured: false,
  basis: "ros",
  week: null,
  players: [],
});
