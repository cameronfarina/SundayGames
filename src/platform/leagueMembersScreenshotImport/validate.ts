import type { LeagueSetupTeamRecord } from "../leagueSetupImport.js";
import { duplicatesFor } from "./duplicates.js";
import { issue } from "./normalization.js";
import { importRowFor } from "./record.js";
import { rowBlockersFor } from "./rowBlockers.js";
import type {
  LeagueMembersScreenshotImportInput,
  LeagueMembersScreenshotImportResult,
  ValidateLeagueMembersScreenshotImportOptions,
} from "./types.js";

const coverageBlockers = (
  input: LeagueMembersScreenshotImportInput,
  options: ValidateLeagueMembersScreenshotImportOptions,
) => {
  if (options.requireTeamMappings !== true || options.existingTeams === undefined) return [];
  const existingIds = new Set(options.existingTeams.map(team => team.id));
  const submittedIds = new Set(input.teams.flatMap(team => {
    const targetTeamId = team.targetTeamId?.trim();
    return targetTeamId === undefined || targetTeamId.length === 0 ? [] : [targetTeamId];
  }));
  const complete = submittedIds.size === existingIds.size
    && [...existingIds].every(teamId => submittedIds.has(teamId));
  return complete
    ? []
    : [issue(
        "team_mapping_coverage_mismatch",
        `Map the imported teams to all ${existingIds.size} existing Mockd profiles exactly once.`,
      )];
};

export const validateLeagueMembersScreenshotImport = (
  input: LeagueMembersScreenshotImportInput,
  options: ValidateLeagueMembersScreenshotImportOptions,
): LeagueMembersScreenshotImportResult => {
  const duplicates = duplicatesFor(input);
  const rows = input.teams.map((team, index) => importRowFor(
    team,
    index,
    rowBlockersFor(team, index, duplicates, options),
  ));
  const countBlockers = input.teams.length === options.expectedTeamCount
    ? []
    : [issue(
        "expected_team_count_mismatch",
        `Expected ${options.expectedTeamCount} teams, but found ${input.teams.length}.`,
      )];
  const blockers = [...countBlockers, ...coverageBlockers(input, options), ...rows.flatMap(row => row.blockers)];
  const status = blockers.length === 0 ? "ready" : "blocked";
  const records: LeagueSetupTeamRecord[] = status === "ready"
    ? rows.flatMap(row => row.record === null ? [] : [row.record])
    : [];

  return {
    status,
    leagueName: input.leagueName?.trim() || null,
    externalLeagueId: input.externalLeagueId?.trim() || null,
    blockers,
    rows,
    records,
  };
};
