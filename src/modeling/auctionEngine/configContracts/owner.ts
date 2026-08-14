import type { Owner, Position } from "../../../../config/league.js";

export type OwnerDemandMultipliers = Partial<
  Record<Owner, Partial<Record<Position, number>>>
>;

export type OwnerAuctionBehaviors = Partial<Record<Owner, OwnerAuctionBehavior>>;

export type OwnerRosterMaximums = Partial<
  Record<Owner, Partial<Record<Position, number>>>
>;

export type OwnerPositionAnchorTargets = Partial<
  Record<Owner, Partial<Record<Position, number>>>
>;

export type OwnerPositionCoreTargets = Partial<
  Record<Owner, Partial<Record<Position, readonly number[]>>>
>;

export type OwnerPositionCoreMaxBids = Partial<
  Record<Owner, Partial<Record<Position, readonly number[]>>>
>;

export type OwnerPositionSlotMaxBids = Partial<
  Record<Owner, Partial<Record<Position, readonly number[]>>>
>;

export interface PositionCoreBudgetEnvelope {
  targetCount: number;
  hardBudget: number;
  minimumFutureCorePrice: number;
}

export type OwnerPositionCoreBudgetEnvelopes = Partial<
  Record<Owner, Partial<Record<Position, PositionCoreBudgetEnvelope>>>
>;

export type OwnerPlayerTargetMaxBids = Partial<
  Record<Owner, Partial<Record<string, number>>>
>;

export type PositionOverbidDamping = Partial<Record<Position, number>>;

export interface OwnerAuctionBehavior {
  priceAggression: number;
  scarcityChase: number;
  replacementPatience: number;
  anchorAggression?: number;
  depthAggression?: number;
}

export type CompleteOwnerAuctionBehavior = Required<OwnerAuctionBehavior>;
