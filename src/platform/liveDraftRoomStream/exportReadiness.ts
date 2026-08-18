import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type {
  LiveDraftRoomExportReadiness,
  LiveDraftRoomTeamSummary,
} from "./contracts/readModel.js";

const exportBlockersFor = (teams: readonly LiveDraftRoomTeamSummary[]): readonly string[] =>
  teams.flatMap(team => [
    ...(team.budgetRemaining !== undefined && team.budgetRemaining < 0
      ? [`${team.ownerDisplayName} has a negative budget.`]
      : []),
    ...(team.rosterSlotsRemaining > 0
      ? [`${team.ownerDisplayName} has ${team.rosterSlotsRemaining} open roster slots.`]
      : []),
  ]);

export const exportReadinessFor = (
  room: LiveDraftRoom,
  teams: readonly LiveDraftRoomTeamSummary[],
): LiveDraftRoomExportReadiness => {
  const blockers = exportBlockersFor(teams);
  if (blockers.length > 0) return { status: "blocked", blockers };
  if (room.status === "ended") {
    return { status: "ready", completedRevision: room.revision, blockers: [] };
  }

  return { status: "pending", blockers: ["Draft room must be ended before final export."] };
};
