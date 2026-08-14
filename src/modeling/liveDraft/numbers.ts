import type { Position } from "../../../config/league.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";

export const emptyPositionCounts = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const roundPrice = (value: number): number =>
  Math.max(1, Math.round(value));

export const maxBidFor = (budgetRemaining: number, rosterSlotsRemaining: number): number => {
  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1));
};

export const draftPriorityScoreFor = ({
  player,
  needMultiplier,
  liveExpectedPrice,
}: {
  player: LiveDraftPlayerRecord;
  needMultiplier: number;
  liveExpectedPrice: number;
}): number => {
  const seasonValueSignal = player.seasonProjection / 4;
  const pricePenalty = liveExpectedPrice * 0.35;
  return roundToTwo((seasonValueSignal * needMultiplier) - pricePenalty);
};
