import type { ScreenshotDuplicates } from "./duplicates.js";
import { issue, normalizedKey } from "./normalization.js";
import type {
  LeagueMembersScreenshotImportIssue,
  LeagueMembersScreenshotTeamInput,
  ValidateLeagueMembersScreenshotImportOptions,
} from "./types.js";

const positionBlockers = (
  team: LeagueMembersScreenshotTeamInput,
  row: number,
  duplicates: ScreenshotDuplicates,
  expectedCount: number,
): LeagueMembersScreenshotImportIssue[] => {
  if (!Number.isSafeInteger(team.draftOrderPosition)
    || team.draftOrderPosition <= 0
    || team.draftOrderPosition > expectedCount) {
    return [issue(
      "invalid_draft_order_position",
      `Team row ${row} needs a whole-number team number from 1 to ${expectedCount}.`,
      row,
    )];
  }
  return duplicates.positions.has(team.draftOrderPosition)
    ? [issue("duplicate_draft_order_position", `Team number ${team.draftOrderPosition} appears more than once.`, row)]
    : [];
};

const mappingBlockers = (
  team: LeagueMembersScreenshotTeamInput,
  index: number,
  duplicates: ScreenshotDuplicates,
  options: ValidateLeagueMembersScreenshotImportOptions,
): LeagueMembersScreenshotImportIssue[] => {
  if (options.requireTeamMappings !== true) return [];
  const row = index + 1;
  const targetTeamId = team.targetTeamId?.trim() ?? "";
  const existingIds = new Set((options.existingTeams ?? []).map(existingTeam => existingTeam.id));
  if (targetTeamId.length === 0) {
    return [issue("missing_team_mapping", `Choose the existing Mockd profile for team row ${row}.`, row)];
  }
  if (!existingIds.has(targetTeamId)) {
    return [issue("invalid_team_mapping", `Team row ${row} references an unavailable Mockd profile.`, row)];
  }
  return duplicates.teamMappings.has(index)
    ? [issue("duplicate_team_mapping", "Each existing profile can be assigned to only one imported team.", row)]
    : [];
};

const identityBlockers = (
  team: LeagueMembersScreenshotTeamInput,
  index: number,
  duplicates: ScreenshotDuplicates,
): LeagueMembersScreenshotImportIssue[] => {
  const row = index + 1;
  const abbreviation = team.abbreviation.trim();
  const teamName = team.teamDisplayName.trim();
  const blockers: LeagueMembersScreenshotImportIssue[] = [];
  if (abbreviation.length === 0) blockers.push(issue("missing_abbreviation", `Team row ${row} needs an abbreviation.`, row));
  else if (abbreviation.length > 12) blockers.push(issue("invalid_abbreviation", `Team row ${row} abbreviation must be 12 characters or fewer.`, row));
  if (teamName.length === 0) blockers.push(issue("blank_team_name", `Team row ${row} needs a team name.`, row));
  else if (/(?:\.\.\.|…)/u.test(teamName)) blockers.push(issue("truncated_team_name", `Team row ${row} has a truncated team name. Replace it with the full name shown in ESPN.`, row));
  else if (duplicates.teamNames.has(index)) blockers.push(issue("duplicate_team_name", `Team "${teamName}" appears more than once.`, row));
  return blockers;
};

const managerBlockers = (
  team: LeagueMembersScreenshotTeamInput,
  row: number,
  duplicates: ScreenshotDuplicates,
): LeagueMembersScreenshotImportIssue[] => {
  const managers = team.managerDisplayNames.map(name => name.trim()).filter(Boolean);
  const blockers = managers.length === 0 || managers.length !== team.managerDisplayNames.length
    ? [issue("blank_manager_name", `Team row ${row} needs at least one manager and cannot contain blank manager names.`, row)]
    : [];
  for (const manager of new Set(managers)) {
    if (duplicates.managerNames.has(normalizedKey(manager))) {
      blockers.push(issue("duplicate_manager_name", `Manager "${manager}" appears on more than one team.`, row));
    }
  }
  return blockers;
};

export const rowBlockersFor = (
  team: LeagueMembersScreenshotTeamInput,
  index: number,
  duplicates: ScreenshotDuplicates,
  options: ValidateLeagueMembersScreenshotImportOptions,
): LeagueMembersScreenshotImportIssue[] => {
  const row = index + 1;
  const review = (team.confidence !== "high" || team.issues.length > 0) && team.confirmed !== true
    ? [issue("review_required", `Team row ${row} needs commissioner confirmation because the screenshot was unclear.`, row)]
    : [];
  return [
    ...positionBlockers(team, row, duplicates, options.expectedTeamCount),
    ...mappingBlockers(team, index, duplicates, options),
    ...identityBlockers(team, index, duplicates),
    ...managerBlockers(team, row, duplicates),
    ...review,
  ];
};
