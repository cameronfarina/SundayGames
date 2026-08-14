import { applySnakeDraftCommand } from "./applyCommand.js";
import type { SnakeDraftCommand } from "./command.js";
import type { SnakeDraftConfig } from "./config.js";
import type { SnakeDraftState } from "./readModels.js";
import { createSnakeDraftState } from "./stateFactory.js";

export const replaySnakeDraft = (
  config: SnakeDraftConfig,
  commands: readonly SnakeDraftCommand[],
): SnakeDraftState => commands.reduce(
  (state, command) => applySnakeDraftCommand(state, command),
  createSnakeDraftState(config),
);
