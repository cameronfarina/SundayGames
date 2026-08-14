import type { SnakeDraftCommand } from "./command.js";
import type { SnakeDraftState } from "./readModels.js";

export const appendCommand = (
  state: SnakeDraftState,
  command: SnakeDraftCommand,
): SnakeDraftState => ({
  ...state,
  session: {
    ...state.session,
    commandLog: [...state.session.commandLog, { ...command }],
  },
});
