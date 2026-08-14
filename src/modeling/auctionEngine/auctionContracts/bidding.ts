import type { Owner } from "../../../../config/league.js";

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

export type AuctionBidDriverDirection = "up" | "down";

export interface AuctionBidDriver {
  key: string;
  multiplier: number;
  direction: AuctionBidDriverDirection;
}

export interface AuctionBidDiagnostics {
  owner: Owner;
  cappedByMaxBid: boolean;
  drivers: AuctionBidDriver[];
}
