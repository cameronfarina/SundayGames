import type { Owner, Position } from "../../../config/league.js";
import type { MockRoster, Player } from "../../types.js";
import { AuctionDiagnosticsMode, AuctionEngineConfig, InitialRostersByOwner, PositionAmounts } from "./configContracts.js";

export interface AuctionOwnerState {
  owner: Owner;
  roster: Player[];
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
}

export interface AuctionBid {
  owner: Owner;
  amount: number;
  uncappedAmount: number;
  maxBid: number;
  strategyBudgetMaxBid?: number;
  playerTargetMaxBid?: number;
  marketPrice: number;
  ownerDemandMultiplier: number;
  rosterNeedMultiplier: number;
  scarcityMultiplier: number;
  behaviorAggressionMultiplier: number;
  behaviorScarcityMultiplier: number;
  buildStyleMultiplier: number;
  replacementPatienceMultiplier: number;
  endgamePressureMultiplier: number;
  roomPressureMultiplier: number;
  competitionPressureMultiplier: number;
  budgetPacingMultiplier: number;
  bidVarianceMultiplier: number;
  topEndDampingMultiplier: number;
  positionOverbidDampingMultiplier: number;
  contextPenaltyDampingMultiplier: number;
  tieBreak: number;
}

export interface AuctionNominationScoreComponents {
  marketPrice: number;
  projection: number;
  ownerNeed: number;
  opponentNeed: number;
  affordability: number;
  scarcity: number;
  flushMoney: number;
  tieBreak: number;
}

export interface AuctionNominationCandidateDiagnostics {
  rank: number;
  player: string;
  position: Position;
  marketPrice: number;
  projectionTotal: number;
  score: number;
  scoreComponents: AuctionNominationScoreComponents;
  weightedComponents: AuctionNominationScoreComponents;
}

export interface AuctionNominationDiagnostics {
  selectedPlayer: string;
  selectedPosition: Position;
  selectedScore: number;
  candidateCount: number;
  topCandidates: AuctionNominationCandidateDiagnostics[];
}

export type AuctionBidDriverDirection = "up" | "down";

export interface AuctionBidDriver {
  key: string;
  multiplier: number;
  direction: AuctionBidDriverDirection;
}

export type AuctionSalePriceBasis =
  | "minimum_bid"
  | "second_bid_plus_minimum"
  | "reserve_price"
  | "nominator_opening_bid"
  | "budget_flush"
  | "winning_bid_cap";

export interface AuctionBidDiagnostics {
  owner: Owner;
  cappedByMaxBid: boolean;
  drivers: AuctionBidDriver[];
}

export interface AuctionRoomPressureDiagnostics {
  legalBidderCount: number;
  biddersAtOrAboveReserve: number;
  biddersAtOrAboveAnchor: number;
  biddersAtOrAboveSalePrice: number;
  cashHeavyBidderCount: number;
  maxBidderMaxBid: number;
  medianBidderMaxBid: number;
  averageBidderMaxBid: number;
  winningOwnerMaxBid: number;
  winningOwnerBudgetRemainingBefore: number;
  winningOwnerBudgetPerRosterSlotBefore: number | null;
}

export interface AuctionPickDiagnostics {
  secondBidAmount: number;
  reservePrice: number;
  nominatorOpeningBid: number;
  uncappedSalePrice: number;
  topEndGuardedPrice: number;
  salePriceBasis: AuctionSalePriceBasis;
  roomPressure: AuctionRoomPressureDiagnostics;
  topBids: AuctionBidDiagnostics[];
}

export interface AuctionSale {
  player: Player;
  winner: Owner;
  price: number;
  marketPrice: number;
  bids: AuctionBid[];
  diagnostics: AuctionPickDiagnostics;
}

export interface ResolveAuctionSaleOptions {
  nominator?: Owner;
  diagnosticsMode?: AuctionDiagnosticsMode;
}

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
