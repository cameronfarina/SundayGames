import type { TeamAssignment } from "../api/importSchemas";

/** Plain-language description of what a submitted row will do on save. */
export const teamAssignmentSummary = (assignment: TeamAssignment): string => {
  if (assignment.effect === "kept") {
    return `${assignment.ownerDisplayName} keeps their team.`;
  }
  if (assignment.effect === "renamed") {
    const previousOwner = assignment.previousOwnerDisplayName ?? "an existing manager";
    const previousTeam = assignment.previousTeamDisplayName;
    const team = previousTeam === undefined ? "" : ` (${previousTeam})`;
    return `${assignment.ownerDisplayName} takes over ${previousOwner}'s team${team}, keeping its keepers.`;
  }
  return `${assignment.ownerDisplayName} starts a new team with no keepers.`;
};
