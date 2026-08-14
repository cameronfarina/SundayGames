import type { LeagueSetupTeamRecord } from "../leagueSetupImport.js";
import type {
  LeagueMembersScreenshotImportIssue,
  LeagueMembersScreenshotImportRow,
  LeagueMembersScreenshotTeamInput,
} from "./types.js";

export const importRowFor = (
  team: LeagueMembersScreenshotTeamInput,
  index: number,
  blockers: readonly LeagueMembersScreenshotImportIssue[],
): LeagueMembersScreenshotImportRow => {
  const managerDisplayNames = team.managerDisplayNames.map(name => name.trim()).filter(Boolean);
  const record: LeagueSetupTeamRecord | null = blockers.length === 0
    ? {
        sourceRowNumber: index + 1,
        draftOrderPosition: team.draftOrderPosition,
        ...(team.targetTeamId === undefined || team.targetTeamId === null
          ? {}
          : { existingTeamId: team.targetTeamId.trim() }),
        abbreviation: team.abbreviation.trim(),
        ownerDisplayName: managerDisplayNames[0] ?? "",
        managerDisplayNames,
        teamDisplayName: team.teamDisplayName.trim(),
        role: "member",
      }
    : null;
  return { rowNumber: index + 1, blockers, record };
};
