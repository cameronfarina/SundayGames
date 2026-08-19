import type {
  BuildLiveDraftRoomReadModelInput,
  LiveDraftRoomReadModel,
} from "./contracts/readModel.js";
import { liveDraftRoomSseRetryMilliseconds } from "./constants.js";
import { exportReadinessFor } from "./exportReadiness.js";
import { eventStreamIdFor } from "./identifiers.js";
import { canMutateRoomFor, roleFor } from "./roles.js";
import { salesLogFor } from "./saleLog.js";
import { selectedTeamFor, viewedTeamIdFor } from "./teamSelection.js";
import { teamSummaryFor } from "./teamSummary.js";

export const buildLiveDraftRoomReadModel = (
  input: BuildLiveDraftRoomReadModelInput,
): LiveDraftRoomReadModel => {
  const role = roleFor(input.room, input.actor);
  const canMutateRoom = canMutateRoomFor(role);
  const teamSummaries = input.room.projection.teams.map(teamSummaryFor);
  const selectedTeam = selectedTeamFor(input, role, teamSummaries);
  const viewedTeamId = viewedTeamIdFor(input, selectedTeam);
  const viewedTeam = viewedTeamId === undefined
    ? undefined
    : teamSummaries.find(team => team.teamId === viewedTeamId);

  return {
    roomId: input.room.roomId,
    leagueId: input.room.leagueId,
    seasonId: input.room.seasonId,
    status: input.room.status,
    revision: input.room.revision,
    updatedAt: input.room.updatedAt.toISOString(),
    role,
    canMutateRoom,
    canExportDraft: canMutateRoom,
    board: input.room.projection.board.map(player => ({ ...player })),
    ...(selectedTeam === undefined ? {} : { selectedTeam }),
    ...(viewedTeam === undefined ? {} : { viewedTeam }),
    teamSummaries,
    salesLog: salesLogFor(input.room),
    ...(input.room.projection.picks === undefined ? {} : {
      picks: input.room.projection.picks.map(pick => ({ ...pick })),
      ...(input.room.projection.onTheClock === undefined
        ? {}
        : { onTheClock: { ...input.room.projection.onTheClock } }),
    }),
    connection: {
      state: "synchronized",
      transport: "sse",
      cursor: eventStreamIdFor(input.room.roomId, input.room.revision),
      revision: input.room.revision,
      retryMilliseconds: liveDraftRoomSseRetryMilliseconds,
      pollingFallback: true,
    },
    exportReadiness: exportReadinessFor(input.room, teamSummaries),
  };
};
