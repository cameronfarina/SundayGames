import type { LeagueSeason } from "../leagueSeason.js";
import {
  applyLeagueSetupImportToSeason,
  type AppliedLeagueSetupImport,
} from "../leagueSetupImport.js";
import type { LeagueMembersScreenshotImportResult } from "./types.js";

export const applyLeagueMembersScreenshotImportToSeason = (
  season: LeagueSeason,
  validatedImport: LeagueMembersScreenshotImportResult,
): AppliedLeagueSetupImport => {
  if (validatedImport.status !== "ready") {
    throw new Error("Resolve screenshot import blockers before applying league setup.");
  }

  const records = validatedImport.records.map((record, index) => {
    if (record.existingTeamId !== undefined) return record;
    const existingTeam = season.teams[index];
    return existingTeam === undefined ? record : { ...record, existingTeamId: existingTeam.id };
  });
  const applied = applyLeagueSetupImportToSeason(season, records);
  applied.season.league = {
    ...applied.season.league,
    ...(validatedImport.leagueName === null ? {} : { name: validatedImport.leagueName }),
  };
  if (validatedImport.externalLeagueId !== null) {
    applied.season.league = {
      ...applied.season.league,
      externalLeagueId: validatedImport.externalLeagueId,
      provider: "espn",
    };
  }
  return applied;
};
