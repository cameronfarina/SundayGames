import { addSelection } from "./addSelection.js";
import { advanceAiToHuman } from "./advance.js";
import type { SnakeDraftCommand } from "./command.js";
import { appendCommand } from "./commandLog.js";
import { SnakeDraftError } from "./error.js";
import { applyKeepers } from "./keepers.js";
import type { SnakeDraftState } from "./readModels.js";
import { undoLastHumanDecision } from "./undo.js";

export const applySnakeDraftCommand = (
  state: SnakeDraftState,
  command: SnakeDraftCommand,
): SnakeDraftState => {
  if (command.expectedRevision !== state.session.revision) {
    throw new SnakeDraftError(
      "stale_revision",
      `Expected revision ${command.expectedRevision}, but the snake draft is at revision ${state.session.revision}.`,
    );
  }

  if (command.type === "start") {
    if (state.session.status !== "setup") {
      throw new SnakeDraftError("invalid_status", "The snake draft has already started.");
    }
    return appendCommand(advanceAiToHuman(applyKeepers({
      ...state,
      session: {
        ...state.session,
        status: "active",
        revision: state.session.revision + 1,
      },
    })), command);
  }

  if (state.session.status !== "active") {
    throw new SnakeDraftError("invalid_status", "Picks require an active snake draft.");
  }
  if (command.type === "undo") {
    return appendCommand(undoLastHumanDecision(state), command);
  }
  if (command.type === "complete") {
    if (state.board.picks.some(pick => pick.selection === undefined)) {
      throw new SnakeDraftError("draft_incomplete", "Every scheduled pick must be filled before completion.");
    }
    return appendCommand({
      ...state,
      session: {
        ...state.session,
        status: "completed",
        revision: state.session.revision + 1,
        currentPick: undefined,
        canUndo: false,
        canComplete: false,
      },
    }, command);
  }

  const currentPick = state.board.picks.find(
    pick => pick.overall === state.session.currentPick?.overall,
  );
  if (currentPick === undefined || currentPick.teamId !== state.session.humanTeamId) {
    throw new SnakeDraftError("not_human_turn", "The human team does not have the current pick.");
  }
  const player = state.configuration.players.find(candidate => candidate.id === command.playerId);
  if (player === undefined) {
    throw new SnakeDraftError("player_not_found", `Player "${command.playerId}" was not found.`);
  }
  if (state.board.players.find(candidate => candidate.id === player.id)?.available !== true) {
    throw new SnakeDraftError("duplicate_player", `${player.name} is already unavailable.`);
  }

  const pickedState = addSelection(state, currentPick, player, "human");
  return appendCommand(advanceAiToHuman({
    ...pickedState,
    session: {
      ...pickedState.session,
      revision: state.session.revision + 1,
      canUndo: true,
    },
  }), command);
};
