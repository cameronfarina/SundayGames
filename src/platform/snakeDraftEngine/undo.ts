import { addSelection } from "./addSelection.js";
import { pickRefFor } from "./draftOrder.js";
import { SnakeDraftError } from "./error.js";
import { applyKeepers } from "./keepers.js";
import type { SnakeDraftState } from "./readModels.js";
import { createSnakeDraftState } from "./stateFactory.js";

export const undoLastHumanDecision = (state: SnakeDraftState): SnakeDraftState => {
  const lastHumanPick = [...state.board.picks]
    .reverse()
    .find(pick => pick.selection?.source === "human");
  if (lastHumanPick === undefined) {
    throw new SnakeDraftError("no_pick_to_undo", "There is no confirmed human pick to undo.");
  }

  let rebuilt = applyKeepers({
    ...createSnakeDraftState(state.configuration),
    session: {
      ...state.session,
      status: "active",
      revision: state.session.revision + 1,
      currentPick: undefined,
      canUndo: false,
      canComplete: false,
    },
  });

  for (const previousPick of state.board.picks) {
    const selection = previousPick.selection;
    if (
      previousPick.overall >= lastHumanPick.overall
      || selection === undefined
      || selection.source === "keeper"
    ) {
      continue;
    }

    const rebuiltPick = rebuilt.board.picks.find(pick => pick.overall === previousPick.overall);
    const player = state.configuration.players.find(candidate => candidate.id === selection.playerId);
    if (rebuiltPick === undefined || player === undefined) {
      throw new SnakeDraftError("invalid_config", "A prior snake draft selection cannot be rebuilt.");
    }
    rebuilt = addSelection(rebuilt, rebuiltPick, player, selection.source);
  }

  const currentPick = rebuilt.board.picks.find(pick => pick.overall === lastHumanPick.overall);
  if (currentPick === undefined) {
    throw new SnakeDraftError("invalid_config", "The undone snake draft pick is no longer scheduled.");
  }

  return {
    ...rebuilt,
    session: {
      ...rebuilt.session,
      currentPick: pickRefFor(currentPick),
      canUndo: rebuilt.board.picks.some(pick => pick.selection?.source === "human"),
    },
  };
};
