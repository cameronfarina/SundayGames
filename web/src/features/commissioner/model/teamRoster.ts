import type { CommissionerSeason } from "../api/seasonSchemas";

export interface TeamRosterRow {
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  /** Kept as typed text so a half-finished edit does not snap back to a number. */
  draftOrder: string;
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
      draftOrder: String(team.draftOrderPosition),
      savedOwnerDisplayName: team.ownerDisplayName,
    }));

/**
 * Sends each row with the team it belongs to, so renaming a manager edits that
 * team instead of matching on a name the commissioner just changed.
 */
export const teamRosterContent = (rows: readonly TeamRosterRow[]): string => [
  "teamId,owner,team,role,draftOrder",
  ...rows.map(row => [
    csvCell(row.teamId),
    csvCell(row.ownerDisplayName),
    csvCell(row.teamDisplayName),
    "member",
    csvCell(row.draftOrder),
  ].join(",")),
].join("\n");

export const withRowEdited = (
  rows: readonly TeamRosterRow[],
  index: number,
  edit: Partial<Pick<TeamRosterRow, "ownerDisplayName" | "teamDisplayName" | "draftOrder">>,
): TeamRosterRow[] =>
  rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...edit } : row);

const renumbered = (ordered: readonly TeamRosterRow[]): TeamRosterRow[] =>
  ordered.map((row, position) => ({ ...row, draftOrder: String(position + 1) }));

/**
 * Moves one team to the slot it asks for and closes the gap behind it, so the
 * board always holds every slot from one to the team count exactly once.
 * A number outside that range restores the order already on screen.
 */
export const withDraftOrderCommitted = (
  rows: readonly TeamRosterRow[],
  index: number,
): TeamRosterRow[] => {
  const moved = rows[index];
  if (moved === undefined) return [...rows];

  const requested = Number(moved.draftOrder);
  if (!Number.isInteger(requested) || requested < 1 || requested > rows.length) {
    return renumbered(rows);
  }

  const others = rows.filter((_, rowIndex) => rowIndex !== index);
  return renumbered([
    ...others.slice(0, requested - 1),
    moved,
    ...others.slice(requested - 1),
  ]);
};
