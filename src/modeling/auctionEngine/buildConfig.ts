import { AuctionEngineConfig, AuctionEngineConfigOverrides } from "./configContracts.js";
import { defaultAuctionEngineConfig } from "./defaultConfig.js";

export const buildAuctionConfig = (
  overrides: AuctionEngineConfigOverrides = {},
): AuctionEngineConfig => ({
  ...defaultAuctionEngineConfig,
  ...overrides,
  ownerDemandMultipliers: overrides.ownerDemandMultipliers ?? defaultAuctionEngineConfig.ownerDemandMultipliers,
  ownerBehaviors: overrides.ownerBehaviors ?? defaultAuctionEngineConfig.ownerBehaviors,
  ownerRosterMaximums: overrides.ownerRosterMaximums ?? defaultAuctionEngineConfig.ownerRosterMaximums,
  ownerPositionAnchorTargets: overrides.ownerPositionAnchorTargets ??
    defaultAuctionEngineConfig.ownerPositionAnchorTargets,
  ownerPositionCoreTargets: overrides.ownerPositionCoreTargets ??
    defaultAuctionEngineConfig.ownerPositionCoreTargets,
  ownerPositionCoreMaxBids: overrides.ownerPositionCoreMaxBids ??
    defaultAuctionEngineConfig.ownerPositionCoreMaxBids,
  ownerPositionSlotMaxBids: overrides.ownerPositionSlotMaxBids ??
    defaultAuctionEngineConfig.ownerPositionSlotMaxBids,
  ownerPositionCoreBudgetEnvelopes: overrides.ownerPositionCoreBudgetEnvelopes ??
    defaultAuctionEngineConfig.ownerPositionCoreBudgetEnvelopes,
  ownerPlayerTargetMaxBids: overrides.ownerPlayerTargetMaxBids ??
    defaultAuctionEngineConfig.ownerPlayerTargetMaxBids,
  positionOverbidDamping: overrides.positionOverbidDamping ?? defaultAuctionEngineConfig.positionOverbidDamping,
  scarcity: {
    ...defaultAuctionEngineConfig.scarcity,
    ...overrides.scarcity,
  },
  rosterNeed: {
    ...defaultAuctionEngineConfig.rosterNeed,
    ...overrides.rosterNeed,
  },
  nomination: {
    ...defaultAuctionEngineConfig.nomination,
    ...overrides.nomination,
  },
  endgameSpend: {
    ...defaultAuctionEngineConfig.endgameSpend,
    ...overrides.endgameSpend,
  },
  roomPressure: {
    ...defaultAuctionEngineConfig.roomPressure,
    ...overrides.roomPressure,
  },
  competitionPressure: {
    ...defaultAuctionEngineConfig.competitionPressure,
    ...overrides.competitionPressure,
  },
  budgetPacing: {
    ...defaultAuctionEngineConfig.budgetPacing,
    ...overrides.budgetPacing,
  },
  bidVariance: {
    ...defaultAuctionEngineConfig.bidVariance,
    ...overrides.bidVariance,
  },
  lateOpeningBid: {
    ...defaultAuctionEngineConfig.lateOpeningBid,
    ...overrides.lateOpeningBid,
  },
  topEndOverbidDamping: {
    ...defaultAuctionEngineConfig.topEndOverbidDamping,
    ...overrides.topEndOverbidDamping,
  },
  contextPenaltyBidDamping: {
    ...defaultAuctionEngineConfig.contextPenaltyBidDamping,
    ...overrides.contextPenaltyBidDamping,
  },
  topEndSaleGuard: {
    ...defaultAuctionEngineConfig.topEndSaleGuard,
    ...overrides.topEndSaleGuard,
  },
  tierSaleGuard: {
    ...defaultAuctionEngineConfig.tierSaleGuard,
    ...overrides.tierSaleGuard,
  },
});
