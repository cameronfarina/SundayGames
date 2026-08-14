import type { LeagueSeason } from "../leagueSeason.js";
import { membershipSeedFor, teamForRecord } from "./teamMapping.js";
import type {
  AppliedLeagueSetupImport,
  LeagueSetupTeamRecord,
} from "./types.js";

export const applyLeagueSetupImportToSeason = (
  season: LeagueSeason,
  records: readonly LeagueSetupTeamRecord[],
): AppliedLeagueSetupImport => {
  const seasonCopy = structuredClone(season);
  const appliedRecords = records.map((record, index) => ({
    record,
    team: teamForRecord(season, record, index),
  }));

  seasonCopy.teams = appliedRecords.map(appliedRecord => appliedRecord.team);

  return {
    season: seasonCopy,
    memberships: appliedRecords.map(({ record, team }) =>
      membershipSeedFor(season.leagueId, record, team)
    ),
  };
};
