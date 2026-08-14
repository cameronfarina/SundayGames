import { createImportIssue } from "./importIssue.js";
import type { DraftLeagueSetupRow } from "./internalTypes.js";
import { normalizeDuplicateKey } from "./normalization.js";
import type { LeagueSetupImportIssue } from "./types.js";

type DuplicateField = "ownerDisplayName" | "teamDisplayName";
type DuplicateCode = "duplicate_owner_name" | "duplicate_team_name";

export const addDuplicateBlockers = (
  drafts: readonly DraftLeagueSetupRow[],
  field: DuplicateField,
  code: DuplicateCode,
  label: "Owner" | "Team",
): LeagueSetupImportIssue[] => {
  const groups = new Map<string, DraftLeagueSetupRow[]>();

  for (const draft of drafts) {
    const value = draft[field];
    if (value.trim().length === 0) continue;

    const key = normalizeDuplicateKey(value);
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }

  const blockers: LeagueSetupImportIssue[] = [];

  for (const duplicates of groups.values()) {
    if (duplicates.length < 2) continue;

    for (const duplicate of duplicates) {
      const blocker = createImportIssue(
        code,
        `${label} "${duplicate[field]}" appears more than once.`,
        duplicate.rowNumber,
      );
      duplicate.blockers.push(blocker);
      blockers.push(blocker);
    }
  }

  return blockers;
};

export const addRowValidationBlockers = (
  drafts: readonly DraftLeagueSetupRow[],
): LeagueSetupImportIssue[] => {
  const blockers: LeagueSetupImportIssue[] = [];

  for (const draft of drafts) {
    if (draft.blockers.some(blocker => blocker.code === "malformed_row")) continue;

    if (draft.role === null) {
      const blocker = createImportIssue(
        "invalid_role",
        `Invalid league setup role "${draft.rawRole}". Use owner, admin, member, or observer.`,
        draft.rowNumber,
      );
      draft.blockers.push(blocker);
      blockers.push(blocker);
    }

    if (draft.ownerDisplayName.length === 0) {
      const blocker = createImportIssue(
        "blank_owner",
        "League setup rows must include an owner.",
        draft.rowNumber,
      );
      draft.blockers.push(blocker);
      blockers.push(blocker);
    }
  }

  return blockers;
};
