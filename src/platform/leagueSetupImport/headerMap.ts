import type { LeagueSetupColumn, RawLeagueSetupRow } from "./internalTypes.js";
import { normalizeHeader } from "./normalization.js";

const headerAliases: Record<LeagueSetupColumn, ReadonlySet<string>> = {
  teamId: new Set(["teamid", "existingteamid"]),
  owner: new Set(["owner", "ownername", "ownerdisplayname", "manager", "managername"]),
  team: new Set(["team", "teamname", "teamdisplayname", "displayname"]),
  email: new Set(["email", "owneremail", "inviteemail"]),
  role: new Set(["role", "membershiprole", "workspacerole"]),
};

const leagueSetupColumns: readonly LeagueSetupColumn[] = [
  "teamId",
  "owner",
  "team",
  "email",
  "role",
];

const columnForHeader = (header: string): LeagueSetupColumn | null => {
  const normalizedHeader = normalizeHeader(header);

  for (const column of leagueSetupColumns) {
    if (headerAliases[column].has(normalizedHeader)) return column;
  }

  return null;
};

export const headerMapFor = (
  row: RawLeagueSetupRow | undefined,
): Map<LeagueSetupColumn, number> | null => {
  if (row === undefined) return null;

  const headerMap = new Map<LeagueSetupColumn, number>();
  let knownHeaderCount = 0;
  let nonEmptyCellCount = 0;

  row.cells.forEach((cell, index) => {
    if (cell.trim().length === 0) return;

    nonEmptyCellCount += 1;
    const column = columnForHeader(cell);
    if (column === null) return;

    knownHeaderCount += 1;
    if (!headerMap.has(column)) headerMap.set(column, index);
  });

  return knownHeaderCount > 0 && knownHeaderCount === nonEmptyCellCount
    ? headerMap
    : null;
};

export const cellValue = (
  row: RawLeagueSetupRow,
  headerMap: ReadonlyMap<LeagueSetupColumn, number> | null,
  column: LeagueSetupColumn,
  positionalIndex: number,
): string => {
  const cellIndex = headerMap?.get(column) ?? positionalIndex;
  return row.cells[cellIndex]?.trim() ?? "";
};

/**
 * Reads a column only when a header names it. Team ids identify a row rather
 * than describe it, so a pasted list that never mentions one must not have a
 * neighbouring cell read as an id.
 */
export const headerCellValue = (
  row: RawLeagueSetupRow,
  headerMap: ReadonlyMap<LeagueSetupColumn, number> | null,
  column: LeagueSetupColumn,
): string | undefined => {
  const cellIndex = headerMap?.get(column);
  if (cellIndex === undefined) return undefined;

  const value = row.cells[cellIndex]?.trim() ?? "";
  return value.length === 0 ? undefined : value;
};
