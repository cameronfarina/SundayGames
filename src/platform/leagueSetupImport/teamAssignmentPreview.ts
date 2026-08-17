import type { LeagueSeason } from "../leagueSeason.js";
import { existingTeamsForRecords } from "./teamMapping.js";
import type { LeagueSetupTeamRecord } from "./types.js";

export interface LeagueSetupTeamAssignment {
  sourceRowNumber: number;
  ownerDisplayName: string;
  teamDisplayName: string;
  /** "kept" reuses the manager's own team, "renamed" takes over the team in
   * this draft slot from someone else, "new" creates a team from nothing. */
  effect: "kept" | "renamed" | "new";
  existingTeamId?: string;
  previousOwnerDisplayName?: string;
  previousTeamDisplayName?: string;
}

/**
 * Reports what each submitted row will do before anything is saved, so a
 * commissioner can see that a renamed manager keeps their team rather than
 * discovering it when a draft room refuses to open.
 */
export const leagueSetupTeamAssignments = (
  season: LeagueSeason,
  records: readonly LeagueSetupTeamRecord[],
): readonly LeagueSetupTeamAssignment[] => {
  const existingTeams = existingTeamsForRecords(season, records);

  return records.map((record, index) => {
    const existingTeam = existingTeams[index];
    if (existingTeam === undefined) {
      return {
        sourceRowNumber: record.sourceRowNumber,
        ownerDisplayName: record.ownerDisplayName,
        teamDisplayName: record.teamDisplayName,
        effect: "new",
      };
    }

    const keptByOwner = existingTeam.ownerDisplayName === record.ownerDisplayName;
    return {
      sourceRowNumber: record.sourceRowNumber,
      ownerDisplayName: record.ownerDisplayName,
      teamDisplayName: record.teamDisplayName,
      effect: keptByOwner ? "kept" : "renamed",
      existingTeamId: existingTeam.id,
      previousOwnerDisplayName: existingTeam.ownerDisplayName,
      previousTeamDisplayName: existingTeam.displayName,
    };
  });
};
