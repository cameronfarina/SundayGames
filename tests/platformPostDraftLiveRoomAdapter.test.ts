import { describe, expect, it } from "vitest";
import type { LeagueSeason } from "../src/platform/leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../src/platform/liveDraftRooms.js";
import {
  analyzeEndedLiveDraftRoomTeam,
  PostDraftLiveRoomAdapterError,
  postDraftScoringSettingsIdForSeason,
} from "../src/platform/postDraftLiveRoomAdapter.js";
import type {
  MyTeamOwnershipContext,
  PostDraftProjectionSnapshot,
} from "../src/platform/postDraftTeamAnalysis.js";

const now = new Date("2026-09-08T12:00:00.000Z");
const leagueId = "league_sunday";
const seasonId = "season_2026";

const season = (): LeagueSeason => ({
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

const catalog = [
  { name: "Owner11 Quarterback", position: "QB", expectedPrice: 20 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
  { name: "Owner12 Quarterback", position: "QB", expectedPrice: 8 },
  { name: "Owner12 Running Back", position: "RB", expectedPrice: 12 },
  { name: "Nick Quarterback", position: "QB", expectedPrice: 7 },
  { name: "Nick Running Back", position: "RB", expectedPrice: 11 },
  { name: "Owner04 Quarterback", position: "QB", expectedPrice: 6 },
  { name: "Owner04 Running Back", position: "RB", expectedPrice: 10 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const endedRoom = (): LiveDraftRoom => {
  const repository = new InMemoryLiveDraftRoomRepository();
  repository.createRoom({
    roomId: "room_sunday_2026",
    commissionerUserId: "user_commissioner",
    viewerPasswordHashRef: "viewer-password-hash",
    season: season(),
    playerCatalog: catalog,
    initialRosters: [
      { teamId: "team_cam", playerName: "Owner11 Quarterback", position: "QB", price: 20 },
      { teamId: "team_cam", playerName: "De'Von Achane", position: "RB", price: 50 },
      { teamId: "team_sam", playerName: "Owner12 Quarterback", position: "QB", price: 8 },
      { teamId: "team_sam", playerName: "Owner12 Running Back", position: "RB", price: 12 },
      { teamId: "team_nick", playerName: "Nick Quarterback", position: "QB", price: 7 },
      { teamId: "team_nick", playerName: "Nick Running Back", position: "RB", price: 11 },
      { teamId: "team_seth", playerName: "Owner04 Quarterback", position: "QB", price: 6 },
      { teamId: "team_seth", playerName: "Owner04 Running Back", position: "RB", price: 10 },
    ],
    createdAt: new Date("2026-09-01T18:00:00.000Z"),
  });
  const actor = {
    userId: "user_commissioner",
    leagueId,
    role: "admin" as const,
  };
  repository.startRoom({
    roomId: "room_sunday_2026",
    actor,
    expectedRevision: 1,
    idempotencyKey: "start-room",
    now: new Date("2026-09-01T19:00:00.000Z"),
  });

  return repository.endRoom({
    roomId: "room_sunday_2026",
    actor,
    expectedRevision: 2,
    idempotencyKey: "end-room",
    now: new Date("2026-09-01T22:00:00.000Z"),
  });
};

const ownership = {
  userId: "user_cam",
  privateOwnerUserId: "user_cam",
  leagueId,
  seasonId,
  teamId: "team_cam",
  ownerId: "owner_cam",
} satisfies MyTeamOwnershipContext;

const projectionSnapshot = (room: LiveDraftRoom): PostDraftProjectionSnapshot => ({
  metadata: {
    snapshotId: "current-projections-2026-week-1",
    leagueId,
    seasonId,
    scoringSettingsId: postDraftScoringSettingsIdForSeason(room.season),
    generatedAt: "2026-09-08T11:30:00.000Z",
    validThrough: "2026-09-08T18:00:00.000Z",
    week: 1,
  },
  projections: [
    {
      playerId: "player_cam_qb",
      playerName: "Owner11 Quarterback",
      position: "QB",
      seasonProjectedPoints: 300,
      weeklyProjectedPoints: 20,
    },
    {
      playerId: "player_achane",
      playerName: "Devon Achane",
      position: "RB",
      seasonProjectedPoints: 250,
      weeklyProjectedPoints: 17,
    },
    {
      playerId: "player_sam_qb",
      playerName: "Owner12 Quarterback",
      position: "QB",
      seasonProjectedPoints: 100,
      weeklyProjectedPoints: 8,
    },
    {
      playerId: "player_sam_rb",
      playerName: "Owner12 Running Back",
      position: "RB",
      seasonProjectedPoints: 80,
      weeklyProjectedPoints: 6,
    },
    {
      playerId: "player_nick_qb",
      playerName: "Nick Quarterback",
      position: "QB",
      seasonProjectedPoints: 90,
      weeklyProjectedPoints: 7,
    },
    {
      playerId: "player_nick_rb",
      playerName: "Nick Running Back",
      position: "RB",
      seasonProjectedPoints: 70,
      weeklyProjectedPoints: 5,
    },
    {
      playerId: "player_seth_qb",
      playerName: "Owner04 Quarterback",
      position: "QB",
      seasonProjectedPoints: 80,
      weeklyProjectedPoints: 6,
    },
    {
      playerId: "player_seth_rb",
      playerName: "Owner04 Running Back",
      position: "RB",
      seasonProjectedPoints: 60,
      weeklyProjectedPoints: 4,
    },
  ],
});

describe("post-draft live room adapter", () => {
  it("returns only the claimed roster and its private analysis from an ended room", () => {
    const room = endedRoom();

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.roster).toEqual({
      teamId: "team_cam",
      ownerId: "owner_cam",
      players: [
        { playerId: "player_cam_qb", playerName: "Owner11 Quarterback", position: "QB" },
        { playerId: "player_achane", playerName: "De'Von Achane", position: "RB" },
      ],
    });
    expect(result.analysis.ownership).toEqual(ownership);
    expect(result.analysis.ranking).toMatchObject({
      status: "available",
      rank: 1,
      teamCount: 4,
    });
    expect(result.analysis.recommendationReadiness.startSit.status).toBe("stale");
    expect(result).not.toHaveProperty("completedDraftRoster");
  });

  it("keeps the ended-room roster current long enough for immediate coach advice", () => {
    const room = endedRoom();
    room.endedAt = new Date("2026-09-08T11:55:00.000Z");
    room.updatedAt = room.endedAt;

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.analysis.recommendationReadiness.startSit.status).toBe("ready");
    expect(result.analysis.recommendationReadiness.pickupDrop.status).toBe("ready");
  });

  it("rejects a room that has not ended with a typed lifecycle error", () => {
    const room = endedRoom();
    room.status = "live";
    room.projection.status = "live";

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "room_not_ended",
      "My Team analysis is available only after the live draft room has ended.",
    ));
  });

  it("rejects analysis requested for another private owner", () => {
    const room = endedRoom();

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership: { ...ownership, privateOwnerUserId: "user_someone_else" },
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    ));
  });

  it("rejects a claimed team that is not in the private room context", () => {
    const room = endedRoom();

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership: { ...ownership, teamId: "team_not_claimed" },
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      "Claimed team team_not_claimed is not owned by owner_cam in this live draft room.",
    ));
  });

  it("rejects a claimed owner that does not own the selected team", () => {
    const room = endedRoom();

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership: { ...ownership, ownerId: "owner_someone_else" },
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      "Claimed team team_cam is not owned by owner_someone_else in this live draft room.",
    ));
  });

  it("rejects projection data from a different league context", () => {
    const room = endedRoom();
    const projections = projectionSnapshot(room);

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: {
        ...projections,
        metadata: { ...projections.metadata, leagueId: "league_other" },
      },
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot does not match the live draft room league and season.",
    ));
  });

  it("returns the roster while marking rankings unavailable for incomplete projection coverage", () => {
    const room = endedRoom();
    const projections = projectionSnapshot(room);

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: {
        ...projections,
        projections: projections.projections.filter(
          projection => projection.playerId !== "player_sam_rb",
        ),
      },
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.roster.teamId).toBe("team_cam");
    expect(result.analysis.ranking).toMatchObject({
      status: "unavailable",
      reasons: [expect.objectContaining({ code: "projection_coverage_incomplete" })],
    });
  });

  it("rejects an unsupported active lineup slot instead of silently changing the lineup", () => {
    const room = endedRoom();
    room.season.settings.roster.lineup.ESPN_SLOT_99 = 1;

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Live draft room uses unsupported starter slot ESPN_SLOT_99.",
    ));
  });
});
