import type { SnakeDraftBoardPick, SnakeDraftState } from "./readModels.js";

export const positionalRunsFor = (
  state: SnakeDraftState,
  pick: SnakeDraftBoardPick,
  window: number,
): ReadonlyMap<string, number> => {
  const playersById = new Map(state.configuration.players.map(player => [player.id, player]));
  const runsByPosition = new Map<string, number>();

  for (const previousPick of state.board.picks) {
    if (previousPick.overall >= pick.overall || previousPick.overall < pick.overall - window) {
      continue;
    }
    const playerId = previousPick.selection?.playerId;
    const position = playerId === undefined ? undefined : playersById.get(playerId)?.position;
    if (position !== undefined) {
      runsByPosition.set(position, (runsByPosition.get(position) ?? 0) + 1);
    }
  }

  return runsByPosition;
};
