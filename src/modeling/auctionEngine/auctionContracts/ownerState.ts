import type { Owner } from "../../../../config/league.js";
import type { Player } from "../../../types.js";

export interface AuctionOwnerState {
  owner: Owner;
  roster: Player[];
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
}
