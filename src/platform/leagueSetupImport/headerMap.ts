import type { LeagueSetupColumn, RawLeagueSetupRow } from "./internalTypes.js";
import { normalizeHeader } from "./normalization.js";

const headerAliases: Record<LeagueSetupColumn, ReadonlySet<string>> = {
  owner: new Set(["owner", "ownername", "ownerdisplayname", "manager", "managername"]),
  team: new Set(["team", "teamname", "teamdisplayname", "displayname"]),
  email: new Set(["email", "owneremail", "inviteemail"]),
  role: new Set(["role", "membershiprole", "workspacerole"]),
};

const leagueSetupColumns: readonly LeagueSetupColumn[] = ["owner", "team", "email", "role"];

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
