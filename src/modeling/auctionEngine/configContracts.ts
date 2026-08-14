import type { Owner, Position } from "../../../config/league.js";
import type { Player } from "../../types.js";

export type PositionAmounts = Record<Position, number>;

export type InitialRostersByOwner = Partial<Record<Owner, readonly Player[]>>;

export type OwnerDemandMultipliers = Partial<Record<Owner, Partial<Record<Position, number>>>>;

export type OwnerAuctionBehaviors = Partial<Record<Owner, OwnerAuctionBehavior>>;

export type OwnerRosterMaximums = Partial<Record<Owner, Partial<Record<Position, number>>>>;

export type OwnerPositionAnchorTargets = Partial<Record<Owner, Partial<Record<Position, number>>>>;

export type OwnerPositionCoreTargets = Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;

export type OwnerPositionCoreMaxBids = Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;

export type OwnerPositionSlotMaxBids = Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;

export type OwnerPositionCoreBudgetEnvelopes =
  Partial<Record<Owner, Partial<Record<Position, PositionCoreBudgetEnvelope>>>>;

export type OwnerPlayerTargetMaxBids = Partial<Record<Owner, Partial<Record<string, number>>>>;

export type PositionOverbidDamping = Partial<Record<Position, number>>;

export type AuctionDiagnosticsMode = "full" | "summary";

export interface ScarcityConfig {
  comparablePriceRatio: number;
  minimumComparablePrice: number;
  bidderDepthWeight: number;
  maxDemandSlotsPerOwner: number;
  slope: number;
  maxMultiplier: number;
}

export interface RosterNeedConfig {
  missingStarterMultiplier: number;
  missingFlexMultiplier: number;
  emptyPremiumPositionMultiplier: number;
  benchQuarterbackMultiplier: number;
  benchTightEndMultiplier: number;
  specialTeamsBenchMultiplier: number;
  lastPositionSlotMultiplier: number;
}

export interface NominationConfig {
  earlyEliteBiasPicks: number;
  earlyMarketPriceWeight: number;
  marketPriceWeight: number;
  projectionWeight: number;
  ownerNeedWeight: number;
  opponentNeedWeight: number;
  affordabilityWeight: number;
  scarcityWeight: number;
  flushMoneyWeight: number;
  tieBreakWeight: number;
}

export interface EndgameSpendConfig {
  startRosterSlotsRemaining: number;
  targetBudgetPerSlot: number;
  slope: number;
  maxMultiplier: number;
}

export interface RoomPressureConfig {
  startRosterSlotsRemaining: number;
  minRosterSlotsRemainingExclusive: number;
  targetBudgetPerSlot: number;
  slope: number;
  maxMultiplier: number;
  minimumPlayerPrice: number;
  maximumPlayerPrice: number;
}

export interface CompetitionPressureConfig {
  minimumPlayerPrice: number;
  anchorPriceRatio: number;
  missingStarterSlope: number;
  missingFlexSlope: number;
  maxRivalAnchors: number;
  maxMultiplier: number;
}

export interface BudgetPacingConfig {
  targetBudgetPerSlotAfterPurchase: number;
  slope: number;
  maxDiscount: number;
  minimumPlayerPrice: number;
}

export interface BidVarianceConfig {
  minimumPlayerPrice: number;
  fullEffectPlayerPrice: number;
  maxDiscount: number;
  maxPremium: number;
}

export interface PositionCoreBudgetEnvelope {
  targetCount: number;
  hardBudget: number;
  minimumFutureCorePrice: number;
}

export interface LateOpeningBidConfig {
  startRosterSlotsRemaining: number;
  targetBudgetPerSlot: number;
  maxPlayerPrice: number;
  maxExtraBid: number;
}

export interface TopEndOverbidDampingConfig {
  startPrice: number;
  fullEffectPrice: number;
  maxOverbidDiscount: number;
}

export interface ContextPenaltyBidDampingConfig {
  minimumPlayerPrice: number;
  startPenalty: number;
  fullEffectPenalty: number;
  maxOverbidDiscount: number;
}

export interface TopEndSaleGuardConfig {
  threshold: number;
  capBelowThresholdAt: number;
  premiumThreshold: number;
  capBelowPremiumThresholdAt: number;
  eliteThreshold: number;
  capBelowEliteThresholdAt: number;
}

export interface TierSaleGuardConfig {
  threshold: number;
  capBelowThresholdAt: number;
  strongThreshold: number;
  capBelowStrongThresholdAt: number;
  maxPremiumStartPrice: number;
  maxPremiumBelowStrongThreshold: number;
}

export interface OwnerAuctionBehavior {
  priceAggression: number;
  scarcityChase: number;
  replacementPatience: number;
  anchorAggression?: number;
  depthAggression?: number;
}

export type CompleteOwnerAuctionBehavior = Required<OwnerAuctionBehavior>;

export interface AuctionEngineConfig {
  owners: readonly Owner[];
  auctionBudget: number;
  rosterSize: number;
  rosterMaximums: PositionAmounts;
  starterMinimums: PositionAmounts;
  flexMinimum: number;
  minimumBid: number;
  reservePriceRatio: number;
  ownerDemandMultipliers: OwnerDemandMultipliers;
  ownerBehaviors: OwnerAuctionBehaviors;
  ownerRosterMaximums: OwnerRosterMaximums;
  ownerPositionAnchorTargets: OwnerPositionAnchorTargets;
  ownerPositionCoreTargets: OwnerPositionCoreTargets;
  ownerPositionCoreMaxBids: OwnerPositionCoreMaxBids;
  ownerPositionSlotMaxBids: OwnerPositionSlotMaxBids;
  ownerPositionCoreBudgetEnvelopes: OwnerPositionCoreBudgetEnvelopes;
  ownerPlayerTargetMaxBids: OwnerPlayerTargetMaxBids;
  positionOverbidDamping: PositionOverbidDamping;
  scarcity: ScarcityConfig;
  rosterNeed: RosterNeedConfig;
  nomination: NominationConfig;
  endgameSpend: EndgameSpendConfig;
  roomPressure: RoomPressureConfig;
  competitionPressure: CompetitionPressureConfig;
  budgetPacing: BudgetPacingConfig;
  bidVariance: BidVarianceConfig;
  lateOpeningBid: LateOpeningBidConfig;
  topEndOverbidDamping: TopEndOverbidDampingConfig;
  contextPenaltyBidDamping: ContextPenaltyBidDampingConfig;
  topEndSaleGuard: TopEndSaleGuardConfig;
  tierSaleGuard: TierSaleGuardConfig;
  seed: string;
}

export type AuctionEngineConfigOverrides =
  Partial<Omit<AuctionEngineConfig, "ownerDemandMultipliers" | "ownerBehaviors" | "ownerRosterMaximums" | "ownerPositionAnchorTargets" | "ownerPositionCoreTargets" | "ownerPositionCoreMaxBids" | "ownerPositionSlotMaxBids" | "ownerPositionCoreBudgetEnvelopes" | "ownerPlayerTargetMaxBids" | "positionOverbidDamping" | "scarcity" | "rosterNeed" | "nomination" | "endgameSpend" | "roomPressure" | "competitionPressure" | "budgetPacing" | "bidVariance" | "lateOpeningBid" | "topEndOverbidDamping" | "contextPenaltyBidDamping" | "topEndSaleGuard" | "tierSaleGuard">> & {
    ownerDemandMultipliers?: OwnerDemandMultipliers;
    ownerBehaviors?: OwnerAuctionBehaviors;
    ownerRosterMaximums?: OwnerRosterMaximums;
    ownerPositionAnchorTargets?: OwnerPositionAnchorTargets;
    ownerPositionCoreTargets?: OwnerPositionCoreTargets;
    ownerPositionCoreMaxBids?: OwnerPositionCoreMaxBids;
    ownerPositionSlotMaxBids?: OwnerPositionSlotMaxBids;
    ownerPositionCoreBudgetEnvelopes?: OwnerPositionCoreBudgetEnvelopes;
    ownerPlayerTargetMaxBids?: OwnerPlayerTargetMaxBids;
    positionOverbidDamping?: PositionOverbidDamping;
    scarcity?: Partial<ScarcityConfig>;
    rosterNeed?: Partial<RosterNeedConfig>;
    nomination?: Partial<NominationConfig>;
    endgameSpend?: Partial<EndgameSpendConfig>;
    roomPressure?: Partial<RoomPressureConfig>;
    competitionPressure?: Partial<CompetitionPressureConfig>;
    budgetPacing?: Partial<BudgetPacingConfig>;
    bidVariance?: Partial<BidVarianceConfig>;
    lateOpeningBid?: Partial<LateOpeningBidConfig>;
    topEndOverbidDamping?: Partial<TopEndOverbidDampingConfig>;
    contextPenaltyBidDamping?: Partial<ContextPenaltyBidDampingConfig>;
    topEndSaleGuard?: Partial<TopEndSaleGuardConfig>;
    tierSaleGuard?: Partial<TierSaleGuardConfig>;
  };
