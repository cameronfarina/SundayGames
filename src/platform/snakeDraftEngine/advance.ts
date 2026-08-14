import { addSelection } from "./addSelection.js";
import { pickRefFor } from "./draftOrder.js";
import type { SnakeDraftState } from "./readModels.js";
import { selectAiPlayer } from "./selectAiPlayer.js";

export const advanceAiToHuman = (state: SnakeDraftState): SnakeDraftState => {
  let nextState = state;

  while (true) {
    const nextPick = nextState.board.picks.find(pick => pick.selection === undefined);
    if (nextPick === undefined || nextPick.teamId === nextState.session.humanTeamId) {
      return {
        ...nextState,
        session: {
          ...nextState.session,
          currentPick: nextPick === undefined ? undefined : pickRefFor(nextPick),
          canComplete: nextPick === undefined,
        },
      };
    }

    nextState = addSelection(nextState, nextPick, selectAiPlayer(nextState, nextPick), "ai");
  }
};
