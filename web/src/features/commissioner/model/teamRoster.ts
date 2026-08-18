import type { CommissionerSeason } from "../api/seasonSchemas";

export interface TeamRosterRow {
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  /** The manager name already saved. Keeper commands resolve a team by name,
   * so an edit that has not been applied yet would match nothing. */
  savedOwnerDisplayName: string;
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
      savedOwnerDisplayName: team.ownerDisplayName,
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
  edit: Partial<Pick<TeamRosterRow, "ownerDisplayName" | "teamDisplayName">>,
): TeamRosterRow[] =>
  rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...edit } : row);
