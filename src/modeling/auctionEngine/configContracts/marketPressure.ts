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
