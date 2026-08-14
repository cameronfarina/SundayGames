import { liveDraftStrategies } from "./definitions.js";
import type {
  ProjectionAdjustedAuctionValueInput,
  ProjectionRankAdjustmentInput,
  RushingReceivingProjectionScoring,
  StrategyAdjustedAuctionValueInput,
} from "./contracts.js";

const projectionRankAdjustmentPerPlace = 0.01;
const maximumProjectionRankAdjustment = 0.12;

export const projectionRankAdjustmentFactor = ({
  projectionPositionRank,
  publicPositionRank,
}: ProjectionRankAdjustmentInput): number => {
  if (projectionPositionRank === undefined || publicPositionRank === undefined
    || !Number.isInteger(projectionPositionRank) || !Number.isInteger(publicPositionRank)
    || projectionPositionRank < 1 || publicPositionRank < 1) return 1;
  const adjustment = Math.max(-maximumProjectionRankAdjustment, Math.min(
    maximumProjectionRankAdjustment,
    (publicPositionRank - projectionPositionRank) * projectionRankAdjustmentPerPlace,
  ));
  return Number((1 + adjustment).toFixed(2));
};

export const projectionAdjustedAuctionValue = ({
  marketValue,
  projectionAdjustmentFactor,
}: ProjectionAdjustedAuctionValueInput): number => {
  if (projectionAdjustmentFactor === undefined || !Number.isFinite(projectionAdjustmentFactor)
    || projectionAdjustmentFactor <= 0) return marketValue;
  return Math.max(1, Math.round(marketValue * projectionAdjustmentFactor));
};

type ScoringKey = keyof RushingReceivingProjectionScoring;
const rushingReceivingScoringKeys: readonly ScoringKey[] = [
  "rushingYards",
  "rushingTouchdown",
  "receivingYards",
  "receivingTouchdown",
  "reception",
];

export const projectionScoringMatches = (
  calibrationScoring: RushingReceivingProjectionScoring | undefined,
  leagueScoring: RushingReceivingProjectionScoring,
): boolean => calibrationScoring !== undefined
  && rushingReceivingScoringKeys.every(key => calibrationScoring[key] === leagueScoring[key]);

export const strategyAdjustedAuctionValue = ({
  marketValue,
  position,
  strategyKey,
  positionCount,
  starterCount,
  flexNeedsPlayer,
  maximumBid,
}: StrategyAdjustedAuctionValueInput): number => {
  const strategy = liveDraftStrategies[strategyKey];
  let premium = positionCount < starterCount ? strategy.starterPremium[position] ?? 0 : 0;
  const anchorTarget = strategy.anchorTargets?.[position] ?? 0;
  if (positionCount < anchorTarget) premium += strategy.depthPremium[position] ?? 0;
  if (flexNeedsPlayer && (position === "RB" || position === "WR" || position === "TE")) {
    premium += Math.max(0, strategy.depthPremium[position] ?? 0);
  }
  if (position === "K" || position === "DST") premium += strategy.starterPremium[position] ?? -1;
  return Math.min(maximumBid, marketValue + 12, Math.max(1, Math.round(marketValue + premium)));
};
