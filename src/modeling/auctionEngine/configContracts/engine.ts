import type { Owner } from "../../../../config/league.js";
import type { PositionAmounts } from "./base.js";
import type {
  BidVarianceConfig,
  BudgetPacingConfig,
  ContextPenaltyBidDampingConfig,
  LateOpeningBidConfig,
  TierSaleGuardConfig,
  TopEndOverbidDampingConfig,
  TopEndSaleGuardConfig,
} from "./bidding.js";
import type {
  CompetitionPressureConfig,
  EndgameSpendConfig,
  NominationConfig,
  RoomPressureConfig,
  RosterNeedConfig,
  ScarcityConfig,
} from "./marketPressure.js";
import type {
  OwnerAuctionBehaviors,
  OwnerDemandMultipliers,
  OwnerPlayerTargetMaxBids,
  OwnerPositionAnchorTargets,
  OwnerPositionCoreBudgetEnvelopes,
  OwnerPositionCoreMaxBids,
  OwnerPositionCoreTargets,
  OwnerPositionSlotMaxBids,
  OwnerRosterMaximums,
  PositionOverbidDamping,
} from "./owner.js";

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

type NestedOverrideKeys =
  | "ownerDemandMultipliers"
  | "ownerBehaviors"
  | "ownerRosterMaximums"
  | "ownerPositionAnchorTargets"
  | "ownerPositionCoreTargets"
  | "ownerPositionCoreMaxBids"
  | "ownerPositionSlotMaxBids"
  | "ownerPositionCoreBudgetEnvelopes"
  | "ownerPlayerTargetMaxBids"
  | "positionOverbidDamping"
  | "scarcity"
  | "rosterNeed"
  | "nomination"
  | "endgameSpend"
  | "roomPressure"
  | "competitionPressure"
  | "budgetPacing"
  | "bidVariance"
  | "lateOpeningBid"
  | "topEndOverbidDamping"
  | "contextPenaltyBidDamping"
  | "topEndSaleGuard"
  | "tierSaleGuard";

export type AuctionEngineConfigOverrides =
  Partial<Omit<AuctionEngineConfig, NestedOverrideKeys>> & {
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
