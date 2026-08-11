import type { FantasyTeam, LeagueSeason } from "./leagueSeason.js";
import type { PlatformLeagueMembership } from "./platformApp.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

export type LeagueSetupImportStatus = "ready" | "blocked";
export type LeagueSetupImportRowStatus = "ready" | "blocked";
export type LeagueSetupImportIssueSeverity = "blocker";

export type LeagueSetupImportIssueCode =
  | "expected_team_count_mismatch"
  | "malformed_row"
  | "blank_owner"
  | "duplicate_owner_name"
  | "duplicate_team_name"
  | "invalid_role";

export interface LeagueSetupImportIssue {
  code: LeagueSetupImportIssueCode;
  severity: LeagueSetupImportIssueSeverity;
  message: string;
  rowNumber?: number;
}

export interface LeagueSetupTeamRecord {
  sourceRowNumber: number;
  ownerDisplayName: string;
  managerDisplayNames?: readonly string[];
  abbreviation?: string;
  draftOrderPosition?: number;
  existingTeamId?: string;
  teamDisplayName: string;
  email?: string;
  role: WorkspaceRole;
}

export interface LeagueSetupImportRowPreview {
  rowNumber: number;
  status: LeagueSetupImportRowStatus;
  blockers: LeagueSetupImportIssue[];
  record: LeagueSetupTeamRecord | null;
}

export interface LeagueSetupImportResult {
  status: LeagueSetupImportStatus;
  blockers: LeagueSetupImportIssue[];
  rows: LeagueSetupImportRowPreview[];
  records: LeagueSetupTeamRecord[];
}

export interface ParseLeagueSetupImportOptions {
  expectedTeamCount?: number;
}

export interface LeagueSetupMembershipSeed extends Pick<PlatformLeagueMembership, "leagueId" | "role"> {
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  email?: string;
}

export interface AppliedLeagueSetupImport {
  season: LeagueSeason;
  memberships: LeagueSetupMembershipSeed[];
}

type LeagueSetupColumn = "owner" | "team" | "email" | "role";

interface RawLeagueSetupRow {
  rowNumber: number;
  cells: string[];
  blockers: LeagueSetupImportIssue[];
}

interface DraftLeagueSetupRow {
  rowNumber: number;
  ownerDisplayName: string;
  teamDisplayName: string;
  email?: string;
  role: WorkspaceRole | null;
  rawRole: string;
  blockers: LeagueSetupImportIssue[];
}

const headerAliases: Record<LeagueSetupColumn, ReadonlySet<string>> = {
  owner: new Set(["owner", "ownername", "ownerdisplayname", "manager", "managername"]),
  team: new Set(["team", "teamname", "teamdisplayname", "displayname"]),
  email: new Set(["email", "owneremail", "inviteemail"]),
  role: new Set(["role", "membershiprole", "workspacerole"]),
};
const leagueSetupColumns: readonly LeagueSetupColumn[] = ["owner", "team", "email", "role"];

const issue = (
  code: LeagueSetupImportIssueCode,
  message: string,
  rowNumber?: number,
): LeagueSetupImportIssue => ({
  code,
  severity: "blocker",
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
});

const normalizeHeader = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizeDuplicateKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const slugFor = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const parseDelimitedLine = (
  line: string,
  delimiter: "," | "|",
  rowNumber: number,
): string[] => {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += character;
  }

  if (inQuotes) {
    throw new Error(`Unterminated quoted field in league setup import row ${rowNumber}.`);
  }

  cells.push(cell.trim());

  return cells;
};

const hasUnquotedPipe = (line: string): boolean => {
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "|" && !inQuotes) return true;
  }

  return false;
};

const parseRawRows = (content: string): RawLeagueSetupRow[] =>
  content
    .split(/\r\n|\n|\r/)
    .map((line, index): RawLeagueSetupRow | null => {
      if (line.trim().length === 0) return null;

      const delimiter = hasUnquotedPipe(line) ? "|" : ",";
      const rowNumber = index + 1;

      try {
        return {
          rowNumber,
          cells: parseDelimitedLine(line, delimiter, rowNumber),
          blockers: [],
        };
      } catch {
        return {
          rowNumber,
          cells: [],
          blockers: [
            issue(
              "malformed_row",
              `Row ${rowNumber} has an unterminated quoted field.`,
              rowNumber,
            ),
          ],
        };
      }
    })
    .filter((row): row is RawLeagueSetupRow => row !== null);

const columnForHeader = (header: string): LeagueSetupColumn | null => {
  const normalizedHeader = normalizeHeader(header);

  for (const column of leagueSetupColumns) {
    if (headerAliases[column].has(normalizedHeader)) return column;
  }

  return null;
};

const headerMapFor = (row: RawLeagueSetupRow | undefined): Map<LeagueSetupColumn, number> | null => {
  if (row === undefined) return null;

  const headerMap = new Map<LeagueSetupColumn, number>();
  let knownHeaderCount = 0;
  let nonEmptyCellCount = 0;

  row.cells.forEach((cell, index) => {
    if (cell.trim().length === 0) return;

    nonEmptyCellCount += 1;
    const column = columnForHeader(cell);
    if (column !== null) {
      knownHeaderCount += 1;
      if (!headerMap.has(column)) headerMap.set(column, index);
    }
  });

  return knownHeaderCount > 0 && knownHeaderCount === nonEmptyCellCount
    ? headerMap
    : null;
};

const cellValue = (
  row: RawLeagueSetupRow,
  headerMap: ReadonlyMap<LeagueSetupColumn, number> | null,
  column: LeagueSetupColumn,
  positionalIndex: number,
): string => {
  const cellIndex = headerMap?.get(column) ?? positionalIndex;

  return row.cells[cellIndex]?.trim() ?? "";
};

const normalizeEmail = (email: string): string | undefined => {
  const normalizedEmail = email.trim().toLowerCase();

  return normalizedEmail.length > 0 ? normalizedEmail : undefined;
};

const roleFor = (role: string): WorkspaceRole | null => {
  const normalizedRole = role.trim().toLowerCase();

  if (normalizedRole.length === 0) return "member";
  if (normalizedRole === "owner") return "owner";
  if (normalizedRole === "admin") return "admin";
  if (normalizedRole === "member") return "member";
  if (normalizedRole === "observer") return "observer";

  return null;
};

const draftRowFor = (
  row: RawLeagueSetupRow,
  headerMap: ReadonlyMap<LeagueSetupColumn, number> | null,
): DraftLeagueSetupRow => {
  const ownerDisplayName = cellValue(row, headerMap, "owner", 0);
  const rawTeamDisplayName = cellValue(row, headerMap, "team", 1);
  const email = normalizeEmail(cellValue(row, headerMap, "email", 2));
  const rawRole = cellValue(row, headerMap, "role", 3);
  const role = roleFor(rawRole);

  return {
    rowNumber: row.rowNumber,
    ownerDisplayName,
    teamDisplayName: rawTeamDisplayName.length > 0 ? rawTeamDisplayName : ownerDisplayName,
    ...(email === undefined ? {} : { email }),
    role,
    rawRole,
    blockers: [...row.blockers],
  };
};

const addDuplicateBlockers = (
  drafts: readonly DraftLeagueSetupRow[],
  field: "ownerDisplayName" | "teamDisplayName",
  code: "duplicate_owner_name" | "duplicate_team_name",
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
      const blocker = issue(
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

const addRowValidationBlockers = (
  drafts: readonly DraftLeagueSetupRow[],
): LeagueSetupImportIssue[] => {
  const blockers: LeagueSetupImportIssue[] = [];

  for (const draft of drafts) {
    if (draft.blockers.some(blocker => blocker.code === "malformed_row")) continue;

    if (draft.role === null) {
      const blocker = issue(
        "invalid_role",
        `Invalid league setup role "${draft.rawRole}". Use owner, admin, member, or observer.`,
        draft.rowNumber,
      );
      draft.blockers.push(blocker);
      blockers.push(blocker);
    }

    if (draft.ownerDisplayName.length === 0) {
      const blocker = issue("blank_owner", "League setup rows must include an owner.", draft.rowNumber);
      draft.blockers.push(blocker);
      blockers.push(blocker);
    }
  }

  return blockers;
};

const recordFor = (draft: DraftLeagueSetupRow): LeagueSetupTeamRecord | null => {
  if (draft.blockers.length > 0 || draft.role === null) return null;

  return {
    sourceRowNumber: draft.rowNumber,
    ownerDisplayName: draft.ownerDisplayName,
    teamDisplayName: draft.teamDisplayName,
    ...(draft.email === undefined ? {} : { email: draft.email }),
    role: draft.role,
  };
};

const rowPreviewFor = (draft: DraftLeagueSetupRow): LeagueSetupImportRowPreview => {
  const record = recordFor(draft);

  return {
    rowNumber: draft.rowNumber,
    status: record === null ? "blocked" : "ready",
    blockers: [...draft.blockers],
    record,
  };
};

const teamForRecord = (
  season: LeagueSeason,
  record: LeagueSetupTeamRecord,
  index: number,
): FantasyTeam => {
  const existingTeam = record.existingTeamId === undefined
    ? season.teams.find(team =>
        normalizeDuplicateKey(team.ownerDisplayName) === normalizeDuplicateKey(record.ownerDisplayName)
      )
    : season.teams.find(team => team.id === record.existingTeamId);
  const draftPositionTeam = season.teams[index];
  const ownerSlug = slugFor(record.ownerDisplayName) || `team-${index + 1}`;
  const teamOrdinal = String(index + 1).padStart(2, "0");

  return {
    id: existingTeam?.id ?? `${season.id}-team-${teamOrdinal}-${ownerSlug}`,
    leagueSeasonId: season.id,
    ownerId: existingTeam?.ownerId ?? `owner-${ownerSlug}`,
    ownerDisplayName: record.ownerDisplayName,
    ...(record.managerDisplayNames === undefined
      ? {}
      : { managerDisplayNames: [...record.managerDisplayNames] }),
    ...(record.abbreviation === undefined ? {} : { abbreviation: record.abbreviation }),
    displayName: record.teamDisplayName,
    draftOrderPosition: record.draftOrderPosition ?? draftPositionTeam?.draftOrderPosition ?? index + 1,
  };
};

const membershipSeedFor = (
  leagueId: string,
  record: LeagueSetupTeamRecord,
  team: FantasyTeam,
): LeagueSetupMembershipSeed => ({
  leagueId,
  ownerId: team.ownerId,
  teamId: team.id,
  ownerDisplayName: record.ownerDisplayName,
  teamDisplayName: record.teamDisplayName,
  ...(record.email === undefined ? {} : { email: record.email }),
  role: record.role,
});

export const parseLeagueSetupImport = (
  content: string,
  options: ParseLeagueSetupImportOptions = {},
): LeagueSetupImportResult => {
  const rawRows = parseRawRows(content);
  const headerMap = headerMapFor(rawRows[0]);
  const dataRows = headerMap === null ? rawRows : rawRows.slice(1);
  const drafts = dataRows.map(row => draftRowFor(row, headerMap));
  const parseBlockers = dataRows.flatMap(row => row.blockers);
  const countBlockers = options.expectedTeamCount === undefined || dataRows.length === options.expectedTeamCount
    ? []
    : [
        issue(
          "expected_team_count_mismatch",
          `Expected ${options.expectedTeamCount} teams, but found ${dataRows.length}.`,
        ),
      ];
  const blockers = [
    ...countBlockers,
    ...parseBlockers,
    ...addDuplicateBlockers(drafts, "ownerDisplayName", "duplicate_owner_name", "Owner"),
    ...addDuplicateBlockers(drafts, "teamDisplayName", "duplicate_team_name", "Team"),
    ...addRowValidationBlockers(drafts),
  ];
  const status: LeagueSetupImportStatus = blockers.length === 0 ? "ready" : "blocked";
  const rows = drafts.map(rowPreviewFor);

  return {
    status,
    blockers,
    rows,
    records: status === "ready" ? rows.map(row => row.record).filter((record): record is LeagueSetupTeamRecord => record !== null) : [],
  };
};

export const applyLeagueSetupImportToSeason = (
  season: LeagueSeason,
  records: readonly LeagueSetupTeamRecord[],
): AppliedLeagueSetupImport => {
  const seasonCopy = structuredClone(season);
  const appliedRecords = records.map((record, index) => ({
    record,
    team: teamForRecord(season, record, index),
  }));
  const teams = appliedRecords.map(appliedRecord => appliedRecord.team);

  seasonCopy.teams = teams;

  return {
    season: seasonCopy,
    memberships: appliedRecords.map(({ record, team }) => membershipSeedFor(season.leagueId, record, team)),
  };
};
