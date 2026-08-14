import type {
  BuildLiveDraftRoomReadModelInput,
  LiveDraftRoomTeamSummary,
  LiveDraftRoomViewerRole,
} from "./contracts/readModel.js";

export const selectedTeamFor = (
  input: BuildLiveDraftRoomReadModelInput,
  role: LiveDraftRoomViewerRole,
  teamSummaries: readonly LiveDraftRoomTeamSummary[],
): LiveDraftRoomTeamSummary | undefined => {
  if (role === "commissioner" && input.selectedTeamId !== undefined) {
    return teamSummaries.find(team => team.teamId === input.selectedTeamId);
  }

  if (role === "observer") return undefined;
  if (input.actor.teamId !== undefined) {
    return teamSummaries.find(team => team.teamId === input.actor.teamId);
  }
  if (input.actor.ownerId !== undefined) {
    return teamSummaries.find(team => team.ownerId === input.actor.ownerId);
  }

  return undefined;
};

export const viewedTeamIdFor = (
  input: BuildLiveDraftRoomReadModelInput,
  selectedTeam: LiveDraftRoomTeamSummary | undefined,
): string | undefined => input.viewedTeamId ?? selectedTeam?.teamId;
