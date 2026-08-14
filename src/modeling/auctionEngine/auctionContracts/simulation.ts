import type { Owner, Position } from "../../../../config/league.js";
import type { MockRoster, Player } from "../../../types.js";
import type {
  AuctionDiagnosticsMode,
  AuctionEngineConfig,
  InitialRostersByOwner,
  PositionAmounts,
} from "../configContracts.js";
import type { AuctionBid } from "./bidding.js";
import type { AuctionNominationDiagnostics } from "./nomination.js";
import type { AuctionOwnerState } from "./ownerState.js";
import type { AuctionPickDiagnostics } from "./sale.js";

export interface AuctionPick {
  pick: number;
  nominator: Owner;
  owner: Owner;
  player: string;
  position: Position;
  marketPrice: number;
  price: number;
  budgetAfterPick: number;
  rosterSlotsAfterPick: number;
  topBids: AuctionBid[];
  diagnostics: AuctionPickDiagnostics;
  nominationDiagnostics: AuctionNominationDiagnostics;
}

export type AuctionBudgetTrajectoryEvent = "initial" | "after_pick";

export interface AuctionBudgetTrajectoryRow {
  pick: number;
  event: AuctionBudgetTrajectoryEvent;
  owner: Owner;
  nominator?: Owner;
  winningOwner?: Owner;
  player?: string;
  position?: Position;
  marketPrice?: number;
  salePrice?: number;
  spent: number;
  initialSpend: number;
  auctionSpend: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  rosterSize: number;
  budgetPerRosterSlot: number | null;
  positionCounts: PositionAmounts;
}

export type AuctionRosters = Partial<Record<Owner, MockRoster>>;

export interface AuctionResult {
  seed: string;
  rosters: AuctionRosters;
  ownerStates: AuctionOwnerState[];
  picks: AuctionPick[];
  budgetTrajectory: AuctionBudgetTrajectoryRow[];
  unsoldPlayers: Player[];
}

export interface SimulateAuctionOptions {
  players: readonly Player[];
  config?: AuctionEngineConfig;
  initialRostersByOwner?: InitialRostersByOwner;
  diagnosticsMode?: AuctionDiagnosticsMode;
}
