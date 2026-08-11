import type { FantasyTeam, LeagueSeason } from "./leagueSeason.js";
import {
  applyLeagueSetupImportToSeason,
  type AppliedLeagueSetupImport,
  type LeagueSetupImportIssueSeverity,
  type LeagueSetupImportStatus,
  type LeagueSetupTeamRecord,
} from "./leagueSetupImport.js";

export type LeagueMembersScreenshotConfidence = "high" | "medium" | "low";

export type LeagueMembersScreenshotImportIssueCode =
  | "expected_team_count_mismatch"
  | "team_mapping_coverage_mismatch"
  | "duplicate_draft_order_position"
  | "invalid_draft_order_position"
  | "missing_abbreviation"
  | "invalid_abbreviation"
  | "blank_team_name"
  | "truncated_team_name"
  | "blank_manager_name"
  | "duplicate_manager_name"
  | "duplicate_team_name"
  | "missing_team_mapping"
  | "invalid_team_mapping"
  | "duplicate_team_mapping"
  | "review_required";

export interface LeagueMembersScreenshotImportIssue {
  code: LeagueMembersScreenshotImportIssueCode;
  severity: LeagueSetupImportIssueSeverity;
  message: string;
  rowNumber?: number;
}

export interface LeagueMembersScreenshotTeamInput {
  draftOrderPosition: number;
  abbreviation: string;
  teamDisplayName: string;
  managerDisplayNames: readonly string[];
  confidence: LeagueMembersScreenshotConfidence;
  issues: readonly string[];
  confirmed?: boolean;
  targetTeamId?: string | null;
}

export interface LeagueMembersScreenshotImportInput {
  leagueName: string | null;
  externalLeagueId: string | null;
  teams: readonly LeagueMembersScreenshotTeamInput[];
}

export interface LeagueMembersScreenshotImportRow {
  rowNumber: number;
  blockers: readonly LeagueMembersScreenshotImportIssue[];
  record: LeagueSetupTeamRecord | null;
}

export interface LeagueMembersScreenshotImportResult {
  status: LeagueSetupImportStatus;
  leagueName: string | null;
  externalLeagueId: string | null;
  blockers: readonly LeagueMembersScreenshotImportIssue[];
  rows: readonly LeagueMembersScreenshotImportRow[];
  records: readonly LeagueSetupTeamRecord[];
}

export interface ValidateLeagueMembersScreenshotImportOptions {
  expectedTeamCount: number;
  existingTeams?: readonly Pick<FantasyTeam, "id" | "ownerDisplayName" | "displayName" | "abbreviation">[];
  requireTeamMappings?: boolean;
}

const normalizedKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const issue = (
  code: LeagueMembersScreenshotImportIssueCode,
  message: string,
  rowNumber?: number,
): LeagueMembersScreenshotImportIssue => ({
  code,
  severity: "blocker",
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
});

const hasTruncationMarker = (value: string): boolean => /(?:\.\.\.|…)/u.test(value);

const duplicateIndexes = (values: readonly string[]): ReadonlySet<number> => {
  const indexesByValue = new Map<string, number[]>();
  values.forEach((value, index) => {
    const key = normalizedKey(value);
    if (key.length === 0) return;
    indexesByValue.set(key, [...(indexesByValue.get(key) ?? []), index]);
  });

  return new Set(
    [...indexesByValue.values()].filter(indexes => indexes.length > 1).flat(),
  );
};

const rowBlockersFor = (
  team: LeagueMembersScreenshotTeamInput,
  index: number,
  duplicatePositions: ReadonlySet<number>,
  duplicateTeamNames: ReadonlySet<number>,
  duplicateManagerNames: ReadonlySet<string>,
  duplicateTeamMappings: ReadonlySet<number>,
  options: ValidateLeagueMembersScreenshotImportOptions,
): LeagueMembersScreenshotImportIssue[] => {
  const rowNumber = index + 1;
  const blockers: LeagueMembersScreenshotImportIssue[] = [];
  const abbreviation = team.abbreviation.trim();
  const teamName = team.teamDisplayName.trim();
  const managers = team.managerDisplayNames.map(name => name.trim()).filter(Boolean);

  if (
    !Number.isSafeInteger(team.draftOrderPosition) ||
    team.draftOrderPosition <= 0 ||
    team.draftOrderPosition > options.expectedTeamCount
  ) {
    blockers.push(issue(
      "invalid_draft_order_position",
      `Team row ${rowNumber} needs a whole-number team number from 1 to ${options.expectedTeamCount}.`,
      rowNumber,
    ));
  } else if (duplicatePositions.has(team.draftOrderPosition)) {
    blockers.push(issue(
      "duplicate_draft_order_position",
      `Team number ${team.draftOrderPosition} appears more than once.`,
      rowNumber,
    ));
  }

  if (options.requireTeamMappings === true) {
    const targetTeamId = team.targetTeamId?.trim() ?? "";
    const existingTeamIds = new Set((options.existingTeams ?? []).map(existingTeam => existingTeam.id));
    if (targetTeamId.length === 0) {
      blockers.push(issue(
        "missing_team_mapping",
        `Choose the existing Mockd profile for team row ${rowNumber}.`,
        rowNumber,
      ));
    } else if (!existingTeamIds.has(targetTeamId)) {
      blockers.push(issue(
        "invalid_team_mapping",
        `Team row ${rowNumber} references an unavailable Mockd profile.`,
        rowNumber,
      ));
    } else if (duplicateTeamMappings.has(index)) {
      blockers.push(issue(
        "duplicate_team_mapping",
        "Each existing Mockd profile can be assigned to only one imported team.",
        rowNumber,
      ));
    }
  }

  if (abbreviation.length === 0) {
    blockers.push(issue("missing_abbreviation", `Team row ${rowNumber} needs an abbreviation.`, rowNumber));
  } else if (abbreviation.length > 12) {
    blockers.push(issue(
      "invalid_abbreviation",
      `Team row ${rowNumber} abbreviation must be 12 characters or fewer.`,
      rowNumber,
    ));
  }

  if (teamName.length === 0) {
    blockers.push(issue("blank_team_name", `Team row ${rowNumber} needs a team name.`, rowNumber));
  } else if (hasTruncationMarker(teamName)) {
    blockers.push(issue(
      "truncated_team_name",
      `Team row ${rowNumber} has a truncated team name. Replace it with the full name shown in ESPN.`,
      rowNumber,
    ));
  } else if (duplicateTeamNames.has(index)) {
    blockers.push(issue(
      "duplicate_team_name",
      `Team "${teamName}" appears more than once.`,
      rowNumber,
    ));
  }

  if (managers.length === 0 || managers.length !== team.managerDisplayNames.length) {
    blockers.push(issue(
      "blank_manager_name",
      `Team row ${rowNumber} needs at least one manager and cannot contain blank manager names.`,
      rowNumber,
    ));
  }
  for (const manager of new Set(managers)) {
    if (duplicateManagerNames.has(normalizedKey(manager))) {
      blockers.push(issue(
        "duplicate_manager_name",
        `Manager "${manager}" appears on more than one team.`,
        rowNumber,
      ));
    }
  }

  if ((team.confidence !== "high" || team.issues.length > 0) && team.confirmed !== true) {
    blockers.push(issue(
      "review_required",
      `Team row ${rowNumber} needs commissioner confirmation because the screenshot was unclear.`,
      rowNumber,
    ));
  }

  return blockers;
};

export const validateLeagueMembersScreenshotImport = (
  input: LeagueMembersScreenshotImportInput,
  options: ValidateLeagueMembersScreenshotImportOptions,
): LeagueMembersScreenshotImportResult => {
  const duplicatePositions = new Set<number>();
  const positions = new Map<number, number>();
  input.teams.forEach(team => positions.set(
    team.draftOrderPosition,
    (positions.get(team.draftOrderPosition) ?? 0) + 1,
  ));
  positions.forEach((count, position) => {
    if (count > 1) duplicatePositions.add(position);
  });
  const duplicateTeamNames = duplicateIndexes(input.teams.map(team => team.teamDisplayName));
  const duplicateTeamMappings = duplicateIndexes(input.teams.map(team => team.targetTeamId ?? ""));
  const managerTeamIndexes = new Map<string, Set<number>>();
  input.teams.forEach((team, teamIndex) => {
    team.managerDisplayNames.forEach(manager => {
      const key = normalizedKey(manager);
      if (key.length === 0) return;
      const indexes = managerTeamIndexes.get(key) ?? new Set<number>();
      indexes.add(teamIndex);
      managerTeamIndexes.set(key, indexes);
    });
  });
  const duplicateManagerNames = new Set(
    [...managerTeamIndexes.entries()]
      .filter(([, indexes]) => indexes.size > 1)
      .map(([manager]) => manager),
  );
  const rows = input.teams.map((team, index): LeagueMembersScreenshotImportRow => {
    const blockers = rowBlockersFor(
      team,
      index,
      duplicatePositions,
      duplicateTeamNames,
      duplicateManagerNames,
      duplicateTeamMappings,
      options,
    );
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
  });
  const countBlockers = input.teams.length === options.expectedTeamCount
    ? []
    : [issue(
        "expected_team_count_mismatch",
        `Expected ${options.expectedTeamCount} teams, but found ${input.teams.length}.`,
      )];
  const existingTeamIds = new Set((options.existingTeams ?? []).map(team => team.id));
  const submittedTeamIds = new Set(input.teams.flatMap(team => {
    const targetTeamId = team.targetTeamId?.trim();
    return targetTeamId === undefined || targetTeamId.length === 0 ? [] : [targetTeamId];
  }));
  const mappingCoverageBlockers = options.requireTeamMappings === true && options.existingTeams !== undefined && (
      submittedTeamIds.size !== existingTeamIds.size ||
      [...existingTeamIds].some(teamId => !submittedTeamIds.has(teamId))
    )
    ? [issue(
        "team_mapping_coverage_mismatch",
        `Map the imported teams to all ${existingTeamIds.size} existing Mockd profiles exactly once.`,
      )]
    : [];
  const blockers = [
    ...countBlockers,
    ...mappingCoverageBlockers,
    ...rows.flatMap(row => row.blockers),
  ];
  const status: LeagueSetupImportStatus = blockers.length === 0 ? "ready" : "blocked";

  return {
    status,
    leagueName: input.leagueName?.trim() || null,
    externalLeagueId: input.externalLeagueId?.trim() || null,
    blockers,
    rows,
    records: status === "ready"
      ? rows.map(row => row.record).filter((record): record is LeagueSetupTeamRecord => record !== null)
      : [],
  };
};

const profileCandidatesFor = (
  team: LeagueMembersScreenshotTeamInput,
  existingTeams: readonly Pick<FantasyTeam, "id" | "ownerDisplayName" | "displayName" | "abbreviation">[],
): readonly string[] => {
  const managerKeys = team.managerDisplayNames.map(normalizedKey);
  const managerTokens = new Set(managerKeys.flatMap(manager => manager.split(/\s+/u)));
  const abbreviationKey = normalizedKey(team.abbreviation);
  const teamNameKey = normalizedKey(team.teamDisplayName);

  return existingTeams.filter(existingTeam => {
    const ownerKey = normalizedKey(existingTeam.ownerDisplayName);
    const existingAbbreviationKey = normalizedKey(existingTeam.abbreviation ?? "");
    const existingTeamNameKey = normalizedKey(existingTeam.displayName);

    return managerKeys.includes(ownerKey) ||
      (!ownerKey.includes(" ") && managerTokens.has(ownerKey)) ||
      (abbreviationKey.length > 0 && abbreviationKey === existingAbbreviationKey) ||
      (teamNameKey.length > 0 && teamNameKey === existingTeamNameKey);
  }).map(existingTeam => existingTeam.id);
};

export const suggestLeagueMembersScreenshotTeamMappings = (
  input: LeagueMembersScreenshotImportInput,
  season: Pick<LeagueSeason, "teams">,
): LeagueMembersScreenshotImportInput => {
  const candidates = input.teams.map(team => profileCandidatesFor(team, season.teams));
  const singleCandidateCounts = new Map<string, number>();
  candidates.forEach(teamCandidates => {
    if (teamCandidates.length !== 1) return;
    const candidate = teamCandidates[0] ?? "";
    singleCandidateCounts.set(candidate, (singleCandidateCounts.get(candidate) ?? 0) + 1);
  });

  return {
    ...input,
    teams: input.teams.map((team, index) => {
      const teamCandidates = candidates[index] ?? [];
      const candidate = teamCandidates.length === 1 ? teamCandidates[0] : undefined;
      return {
        ...team,
        targetTeamId: candidate !== undefined && singleCandidateCounts.get(candidate) === 1
          ? candidate
          : null,
      };
    }),
  };
};

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
    ...(validatedImport.externalLeagueId === null
      ? {}
      : { externalLeagueId: validatedImport.externalLeagueId, provider: "espn" as const }),
  };

  return applied;
};
