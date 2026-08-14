import { addSelection } from "./addSelection.js";
import { SnakeDraftError } from "./error.js";
import type { SnakeDraftState } from "./readModels.js";

export const applyKeepers = (state: SnakeDraftState): SnakeDraftState => {
  let nextState = state;

  for (const keeper of state.configuration.keepers ?? []) {
    const pick = nextState.board.picks.find(candidate =>
      candidate.round === keeper.round && candidate.pickInRound === keeper.pickInRound,
    );
    if (pick === undefined || pick.teamId !== keeper.teamId) {
      throw new SnakeDraftError(
        "invalid_keeper",
        `Keeper ${keeper.playerId} is not assigned to a pick owned by ${keeper.teamId}.`,
      );
    }
    if (pick.selection !== undefined) {
      throw new SnakeDraftError(
        "invalid_keeper",
        `Pick ${keeper.round}.${keeper.pickInRound} already has a keeper.`,
      );
    }

    const player = state.configuration.players.find(candidate => candidate.id === keeper.playerId);
    if (player === undefined) {
      throw new SnakeDraftError("player_not_found", `Keeper player "${keeper.playerId}" was not found.`);
    }
    const isAvailable = nextState.board.players.find(candidate => candidate.id === player.id)?.available;
    if (isAvailable !== true) {
      throw new SnakeDraftError("duplicate_player", `${player.name} is already unavailable.`);
    }

    nextState = addSelection(nextState, pick, player, "keeper");
  }

  return nextState;
};
