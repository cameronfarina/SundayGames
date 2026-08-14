import { normalizeLeagueSeasonSettings } from "../leagueSeason.js";
import type { AnalyzePostDraftTeamInput } from "../postDraftTeamAnalysis.js";
import type { AnalyzeEndedLiveDraftRoomTeamInput } from "./contracts.js";
import type { LiveRoomRosters } from "./rosters.js";
import { postDraftScoringSettingsIdForSeason } from "./scoring.js";
import { starterSlotsFor } from "./starterSlots.js";

const endedRoomRosterSnapshotTtlMs = 24 * 60 * 60 * 1_000;

export const buildAnalysisInput = (
  input: AnalyzeEndedLiveDraftRoomTeamInput,
  rosters: LiveRoomRosters,
): AnalyzePostDraftTeamInput => {
  const settings = normalizeLeagueSeasonSettings(input.room.season.settings);
  const capturedAt = (input.room.endedAt ?? input.room.updatedAt).toISOString();
  const validThrough = new Date(
    Date.parse(capturedAt) + endedRoomRosterSnapshotTtlMs,
  ).toISOString();
  const snapshotPrefix = `live-draft:${input.room.roomId}`;

  return {
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
      snapshotId: `${snapshotPrefix}:revision:${input.room.revision}`,
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      capturedAt,
      status: "complete",
      draftFormat: settings.draftFormat,
      teams: rosters.teams,
    },
    projectionSnapshot: input.projectionSnapshot,
    currentRosterSnapshot: {
      snapshotId: `${snapshotPrefix}:team:${rosters.roster.teamId}:revision:${input.room.revision}`,
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      teamId: rosters.roster.teamId,
      privateOwnerUserId: input.ownership.privateOwnerUserId,
      capturedAt,
      validThrough,
      players: rosters.roster.players,
    },
    freeAgentSnapshot: {
      snapshotId: `${snapshotPrefix}:free-agents:revision:${input.room.revision}`,
      leagueId: input.room.leagueId,
      seasonId: input.room.seasonId,
      capturedAt,
      validThrough,
      players: rosters.freeAgentPlayers,
    },
  };
};
