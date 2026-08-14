import { createGenericAuctionMockState } from "../state.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockConfig,
  GenericAuctionMockState,
} from "../types.js";
import { applyGenericAuctionMockCommand } from "./applyCommand.js";

export const replayGenericAuctionMock = (
  config: GenericAuctionMockConfig,
  commands: readonly GenericAuctionMockCommand[],
): GenericAuctionMockState => commands.reduce(
  (state, command) => applyGenericAuctionMockCommand(state, command),
  createGenericAuctionMockState(config),
);
