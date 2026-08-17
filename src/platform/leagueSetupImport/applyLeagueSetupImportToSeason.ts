import type { LeagueSeason } from "../leagueSeason.js";
import { existingTeamsForRecords, membershipSeedFor, teamForRecord } from "./teamMapping.js";
import type {
  AppliedLeagueSetupImport,
  LeagueSetupTeamRecord,
} from "./types.js";

export const applyLeagueSetupImportToSeason = (
  season: LeagueSeason,
  records: readonly LeagueSetupTeamRecord[],
): AppliedLeagueSetupImport => {
  const seasonCopy = structuredClone(season);
  const existingTeams = existingTeamsForRecords(season, records);
  const appliedRecords = records.map((record, index) => ({
    record,
    team: teamForRecord(season, record, index, existingTeams[index]),
  }));

  seasonCopy.teams = appliedRecords.map(appliedRecord => appliedRecord.team);

  return {
    season: seasonCopy,
    memberships: appliedRecords.map(({ record, team }) =>
      membershipSeedFor(season.leagueId, record, team)
    ),
  };
};
