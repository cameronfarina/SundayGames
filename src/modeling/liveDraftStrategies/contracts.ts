import type { Position } from "../../../config/league.js";

export type LiveDraftStrategyKey = "balanced" | "three-rb" | "hero-rb" | "wr-heavy";

export interface LiveDraftStrategyDefinition {
  key: LiveDraftStrategyKey;
  label: string;
  starterPremium: Partial<Record<Position, number>>;
  depthPremium: Partial<Record<Position, number>>;
  needMultiplier: Partial<Record<Position, number>>;
  tags: Partial<Record<Position, string>>;
  anchorTargets?: Partial<Record<Position, number>>;
}

export interface ProjectionRankAdjustmentInput {
  projectionPositionRank?: number | undefined;
  publicPositionRank?: number | undefined;
}

export interface ProjectionAdjustedAuctionValueInput {
  marketValue: number;
  projectionAdjustmentFactor?: number | undefined;
}

export interface RushingReceivingProjectionScoring {
  rushingYards: number;
  rushingTouchdown: number;
  receivingYards: number;
  receivingTouchdown: number;
  reception: number;
}

export interface StrategyAdjustedAuctionValueInput {
  marketValue: number;
  position: Position;
  strategyKey: LiveDraftStrategyKey;
  positionCount: number;
  starterCount: number;
  flexNeedsPlayer: boolean;
  maximumBid: number;
}
