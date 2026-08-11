import { createHash } from "node:crypto";
import type { Position } from "../../config/league.js";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  normalizeLeagueSeasonSettings,
  type LeagueSeason,
} from "./leagueSeason.js";
import type { LiveDraftRoom } from "./liveDraftRooms.js";
import {
  analyzePostDraftTeam,
  type AnalyzePostDraftTeamInput,
  type MyTeamOwnershipContext,
  type PostDraftProjectionSnapshot,
  type PostDraftTeamAnalysis,
  type PostDraftTeamRoster,
  type PostDraftStarterSlot,
} from "./postDraftTeamAnalysis.js";

export interface AnalyzeEndedLiveDraftRoomTeamInput {
  room: LiveDraftRoom;
  ownership: MyTeamOwnershipContext;
  projectionSnapshot: PostDraftProjectionSnapshot;
  evaluatedAt: Date;
  currentWeek: number;
}

export interface PrivatePostDraftTeamResult {
  roster: PostDraftTeamRoster;
  analysis: PostDraftTeamAnalysis;
}

export type PostDraftLiveRoomAdapterErrorCode =
  | "context_mismatch"
  | "owned_team_mismatch"
  | "private_owner_mismatch"
  | "projection_coverage_incomplete"
  | "room_not_ended";

export class PostDraftLiveRoomAdapterError extends Error {
  constructor(
    readonly code: PostDraftLiveRoomAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PostDraftLiveRoomAdapterError";
  }
}

const scoringDocumentFor = (season: LeagueSeason): string => {
  const scoring = normalizeLeagueSeasonSettings(season.settings).scoring;

  return JSON.stringify({
    passingYards: scoring.passingYards,
    passingTouchdown: scoring.passingTouchdown,
    rushingYards: scoring.rushingYards,
    rushingTouchdown: scoring.rushingTouchdown,
    receivingYards: scoring.receivingYards,
    receivingTouchdown: scoring.receivingTouchdown,
    reception: scoring.reception,
  });
};

export const postDraftScoringSettingsIdForSeason = (season: LeagueSeason): string =>
  `${season.id}:scoring:${createHash("sha256").update(scoringDocumentFor(season)).digest("hex").slice(0, 16)}`;

const eligiblePositionsBySlot: Readonly<Record<string, readonly Position[]>> = {
  QB: ["QB"],
  RB: ["RB"],
  RB_WR: ["RB", "WR"],
  WR: ["WR"],
  WR_TE: ["WR", "TE"],
  TE: ["TE"],
  OP: ["QB", "RB", "WR", "TE"],
  FLEX: ["RB", "WR", "TE"],
  K: ["K"],
  DST: ["DST"],
};
const nonStarterSlots = new Set(["BENCH", "IR"]);
const endedRoomRosterSnapshotTtlMs = 24 * 60 * 60 * 1_000;

const starterSlotsFor = (season: LeagueSeason): PostDraftStarterSlot[] =>
  Object.entries(normalizeLeagueSeasonSettings(season.settings).roster.lineup).flatMap(
    ([slot, count]) => {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new PostDraftLiveRoomAdapterError(
          "context_mismatch",
          `Live draft room has an invalid count for lineup slot ${slot}.`,
        );
      }
      if (count === 0 || nonStarterSlots.has(slot)) return [];

      const eligiblePositions = eligiblePositionsBySlot[slot];
      if (eligiblePositions === undefined) {
        throw new PostDraftLiveRoomAdapterError(
          "context_mismatch",
          `Live draft room uses unsupported starter slot ${slot}.`,
        );
      }

      return Array.from({ length: count }, (_, index) => ({
        slot: count === 1 ? slot : `${slot}${index + 1}`,
        eligiblePositions,
      }));
    },
  );

export const analyzeEndedLiveDraftRoomTeam = (
  input: AnalyzeEndedLiveDraftRoomTeamInput,
): PrivatePostDraftTeamResult => {
  if (input.room.status !== "ended") {
    throw new PostDraftLiveRoomAdapterError(
      "room_not_ended",
      "My Team analysis is available only after the live draft room has ended.",
    );
  }
  if (input.ownership.userId !== input.ownership.privateOwnerUserId) {
    throw new PostDraftLiveRoomAdapterError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    );
  }
  if (
    input.room.season.id !== input.room.seasonId ||
    input.room.season.leagueId !== input.room.leagueId ||
    input.room.season.league.id !== input.room.leagueId ||
    input.room.projection.roomId !== input.room.roomId ||
    input.room.projection.leagueId !== input.room.leagueId ||
    input.room.projection.seasonId !== input.room.seasonId ||
    input.room.projection.status !== input.room.status
  ) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Live draft room context is internally inconsistent.",
    );
  }
  if (
    input.ownership.leagueId !== input.room.leagueId ||
    input.ownership.seasonId !== input.room.seasonId
  ) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Claimed ownership does not match the live draft room league and season.",
    );
  }
  if (
    input.projectionSnapshot.metadata.leagueId !== input.room.leagueId ||
    input.projectionSnapshot.metadata.seasonId !== input.room.seasonId
  ) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot does not match the live draft room league and season.",
    );
  }
  if (
    input.projectionSnapshot.metadata.scoringSettingsId !== undefined &&
    input.projectionSnapshot.metadata.scoringSettingsId !== postDraftScoringSettingsIdForSeason(input.room.season)
  ) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot scoring does not match the live draft room settings.",
    );
  }
  const claimedRoomTeam = input.room.projection.teams.find(team =>
    team.teamId === input.ownership.teamId && team.ownerId === input.ownership.ownerId
  );
  if (claimedRoomTeam === undefined) {
    throw new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      `Claimed team ${input.ownership.teamId} is not owned by ${input.ownership.ownerId} in this live draft room.`,
    );
  }

  const settings = normalizeLeagueSeasonSettings(input.room.season.settings);
  const projectionsByIdentity = new Map(
    input.projectionSnapshot.projections.map(projection => [
      canonicalPlayerIdentityKey(projection.playerName),
      projection,
    ]),
  );
  const teams = input.room.projection.teams.map(team => ({
    teamId: team.teamId,
    ownerId: team.ownerId,
    players: team.roster.map(player => {
      const projection = projectionsByIdentity.get(canonicalPlayerIdentityKey(player.name));

      return {
        playerId: projection?.position === player.position
          ? projection.playerId
          : `draft-player:${canonicalPlayerIdentityKey(player.name)}`,
        playerName: player.name,
        position: player.position,
      };
    }),
  }));
  const roster = teams.find(team => team.teamId === input.ownership.teamId);
  if (roster === undefined) {
    throw new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      `Claimed team ${input.ownership.teamId} is not owned by ${input.ownership.ownerId} in this live draft room.`,
    );
  }
  const capturedAt = (input.room.endedAt ?? input.room.updatedAt).toISOString();
  const rosterValidThrough = new Date(
    Date.parse(capturedAt) + endedRoomRosterSnapshotTtlMs,
  ).toISOString();
  const draftedPlayerKeys = new Set(
    input.room.projection.teams.flatMap(team => team.roster)
      .map(player => canonicalPlayerIdentityKey(player.name)),
  );
  const freeAgentPlayers = input.room.playerCatalog
    .filter(player => !draftedPlayerKeys.has(canonicalPlayerIdentityKey(player.name)))
    .map(player => {
      const projection = projectionsByIdentity.get(canonicalPlayerIdentityKey(player.name));

      return {
        playerId: projection?.position === player.position
          ? projection.playerId
          : `draft-player:${canonicalPlayerIdentityKey(player.name)}`,
        playerName: player.name,
        position: player.position,
      };
    });

  const analysisInput: AnalyzePostDraftTeamInput = {
    ownership: input.ownership,
    evaluatedAt: input.evaluatedAt,
    currentWeek: input.currentWeek,
    leagueSettings: {
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      scoring: {
        id: postDraftScoringSettingsIdForSeason(input.room.season),
        rules: { ...settings.scoring },
      },
      roster: {
        rosterSize: settings.roster.rosterSize,
        starterSlots: starterSlotsFor(input.room.season),
      },
    },
    completedDraftRoster: {
      snapshotId: `live-draft:${input.room.roomId}:revision:${input.room.revision}`,
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      capturedAt,
      status: "complete",
      draftFormat: settings.draftFormat,
      teams,
    },
    projectionSnapshot: input.projectionSnapshot,
    currentRosterSnapshot: {
      snapshotId: `live-draft:${input.room.roomId}:team:${roster.teamId}:revision:${input.room.revision}`,
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      teamId: roster.teamId,
      privateOwnerUserId: input.ownership.privateOwnerUserId,
      capturedAt,
      validThrough: rosterValidThrough,
      players: roster.players,
    },
    freeAgentSnapshot: {
      snapshotId: `live-draft:${input.room.roomId}:free-agents:revision:${input.room.revision}`,
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      capturedAt,
      validThrough: rosterValidThrough,
      players: freeAgentPlayers,
    },
  };

  return {
    roster,
    analysis: analyzePostDraftTeam(analysisInput),
  };
};
