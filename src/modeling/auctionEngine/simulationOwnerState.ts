import type { Player } from "../../types.js";
import type { AuctionOwnerState } from "./auctionContracts.js";
import type { AuctionEngineConfig } from "./configContracts.js";
import { ownerStateFromRoster } from "./ownerStates.js";

export const applySaleToState = (
  state: AuctionOwnerState,
  soldPlayer: Player,
  config: AuctionEngineConfig,
): AuctionOwnerState =>
  ownerStateFromRoster(state.owner, [...state.roster, soldPlayer], config);

export const allRostersFull = (states: readonly AuctionOwnerState[]): boolean =>
  states.every(state => state.rosterSlotsRemaining === 0);
