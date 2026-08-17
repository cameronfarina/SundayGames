import type { CommissionerSeason } from "../api/seasonSchemas";

export interface TeamRosterRow {
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

const csvCell = (value: string): string =>
  /["\n,]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;

export const teamRosterRows = (season: CommissionerSeason): TeamRosterRow[] =>
  [...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => ({
      teamId: team.id,
      ownerDisplayName: team.ownerDisplayName,
      teamDisplayName: team.displayName,
    }));

/**
 * Sends each row with the team it belongs to, so renaming a manager edits that
 * team instead of matching on a name the commissioner just changed.
 */
export const teamRosterContent = (rows: readonly TeamRosterRow[]): string => [
  "teamId,owner,team,role",
  ...rows.map(row => [
    csvCell(row.teamId),
    csvCell(row.ownerDisplayName),
    csvCell(row.teamDisplayName),
    "member",
  ].join(",")),
].join("\n");

export const withRowEdited = (
  rows: readonly TeamRosterRow[],
  index: number,
  edit: Partial<Omit<TeamRosterRow, "teamId">>,
): TeamRosterRow[] =>
  rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...edit } : row);

export const withRowMoved = (
  rows: readonly TeamRosterRow[],
  index: number,
  offset: number,
): TeamRosterRow[] => {
  const target = index + offset;
  const row = rows[index];
  const swapped = rows[target];
  if (row === undefined || swapped === undefined) return [...rows];

  return rows.map((current, rowIndex) => {
    if (rowIndex === index) return swapped;
    return rowIndex === target ? row : current;
  });
};
