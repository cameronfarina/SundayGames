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
