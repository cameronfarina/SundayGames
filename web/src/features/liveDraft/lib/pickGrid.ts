import type { LiveDraftPick } from "../api/liveDraftSchemas";

export interface PickBoardColumn {
  readonly teamId: string;
  readonly label: string;
}

export interface PickBoardCell {
  readonly teamId: string;
  readonly pick: LiveDraftPick | undefined;
}

export interface PickBoardRow {
  readonly round: number;
  readonly cells: readonly PickBoardCell[];
}

/**
 * Round one runs in draft order, so it names the columns. Later rounds reverse,
 * which is why a team's picks only line up when each team keeps one column.
 */
export const pickBoardColumns = (picks: readonly LiveDraftPick[]): readonly PickBoardColumn[] =>
  [...picks]
    .filter(pick => pick.round === 1)
    .sort((left, right) => left.pickInRound - right.pickInRound)
    .map(pick => ({ teamId: pick.teamId, label: pick.ownerDisplayName }));

export const pickBoardRows = (
  picks: readonly LiveDraftPick[],
  columns: readonly PickBoardColumn[],
): readonly PickBoardRow[] => {
  const byRound = new Map<number, Map<string, LiveDraftPick>>();
  for (const pick of picks) {
    const row = byRound.get(pick.round) ?? new Map<string, LiveDraftPick>();
    row.set(pick.teamId, pick);
    byRound.set(pick.round, row);
  }

  return [...byRound.entries()]
    .sort(([left], [right]) => left - right)
    .map(([round, row]) => ({
      round,
      cells: columns.map(column => ({ teamId: column.teamId, pick: row.get(column.teamId) })),
    }));
};
