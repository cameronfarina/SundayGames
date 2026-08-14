import type { Owner, Position } from "../../../config/league.js";
import type { ForcedAuctionSale } from "../mockBatch.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";

type ForcedStartSource = "keeper" | "forced-sale";

export interface StrategyLabScenario {
  key: string;
  label: string;
  question: string;
  strategyKey: LiveDraftStrategyKey;
  forcedSales: readonly ForcedAuctionSale[];
  targetMaxBids?: readonly StrategyLabTargetMaxBid[];
  notes?: string;
}

export interface StrategyLabTargetMaxBid {
  owner: Owner;
  player: string;
  maxBid: number;
}

export interface StrategyLabForcedStartPlayer {
  player: string;
  position: Position;
  price: number;
  source: ForcedStartSource;
}

export interface StrategyLabForcedStart {
  spend: number;
  budgetRemaining: number;
  slotsRemaining: number;
  maxBid: number;
  players: StrategyLabForcedStartPlayer[];
}

export interface BuildAroundStrategyLabScenarioOptions {
  player: string;
  prices: readonly number[];
  strategyKey: LiveDraftStrategyKey;
  baseForcedSales?: readonly ForcedAuctionSale[];
  targetMaxBids?: readonly StrategyLabTargetMaxBid[];
}
