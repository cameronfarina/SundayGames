import type { Position } from "../../config/league.js";

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

export const liveDraftStrategies = {
  balanced: {
    key: "balanced",
    label: "Balanced",
    starterPremium: {
      QB: 4,
      RB: 4,
      WR: 4,
      TE: 3,
      K: -1,
      DST: -1,
    },
    depthPremium: {
      RB: 1,
      WR: 1,
      TE: 0,
    },
    needMultiplier: {
      QB: 0.45,
      RB: 0.45,
      WR: 0.45,
      TE: 0.35,
      K: -0.4,
      DST: -0.4,
    },
    tags: {},
  },
  "three-rb": {
    key: "three-rb",
    label: "True 3RB",
    starterPremium: {
      QB: 3,
      RB: 6,
      WR: 3,
      TE: 2,
      K: -1,
      DST: -1,
    },
    depthPremium: {
      RB: 4,
      WR: 3,
      TE: 2,
    },
    needMultiplier: {
      QB: 0.4,
      RB: 0.75,
      WR: 0.25,
      TE: 0.2,
      K: -0.4,
      DST: -0.4,
    },
    tags: {
      RB: "3RB core",
    },
    anchorTargets: {
      RB: 3,
    },
  },
  "hero-rb": {
    key: "hero-rb",
    label: "Hero RB",
    starterPremium: {
      QB: 3,
      RB: 5,
      WR: 5,
      TE: 3,
      K: -1,
      DST: -1,
    },
    depthPremium: {
      RB: -1,
      WR: 3,
      TE: 1,
    },
    needMultiplier: {
      QB: 0.4,
      RB: 0.35,
      WR: 0.65,
      TE: 0.25,
      K: -0.4,
      DST: -0.4,
    },
    tags: {
      RB: "hero RB",
      WR: "WR support",
    },
    anchorTargets: {
      RB: 1,
    },
  },
  "wr-heavy": {
    key: "wr-heavy",
    label: "WR Heavy",
    starterPremium: {
      QB: 3,
      RB: 3,
      WR: 7,
      TE: 3,
      K: -1,
      DST: -1,
    },
    depthPremium: {
      RB: 1,
      WR: 5,
      TE: 2,
    },
    needMultiplier: {
      QB: 0.4,
      RB: 0.2,
      WR: 0.8,
      TE: 0.25,
      K: -0.4,
      DST: -0.4,
    },
    tags: {
      WR: "WR core",
    },
    anchorTargets: {
      WR: 3,
    },
  },
} as const satisfies Record<LiveDraftStrategyKey, LiveDraftStrategyDefinition>;

export const defaultLiveDraftStrategyKey: LiveDraftStrategyKey = "three-rb";

export const liveDraftStrategyFor = (key: LiveDraftStrategyKey): LiveDraftStrategyDefinition =>
  liveDraftStrategies[key];

export const parseLiveDraftStrategyKey = (value: unknown): LiveDraftStrategyKey => {
  if (typeof value === "string" && value in liveDraftStrategies) return value as LiveDraftStrategyKey;
  return defaultLiveDraftStrategyKey;
};

export interface ProjectionAdjustedAuctionValueInput {
  marketValue: number;
  projectionAdjustmentFactor?: number | undefined;
}

export const projectionAdjustedAuctionValue = ({
  marketValue,
  projectionAdjustmentFactor,
}: ProjectionAdjustedAuctionValueInput): number => {
  if (
    projectionAdjustmentFactor === undefined
    || !Number.isFinite(projectionAdjustmentFactor)
    || projectionAdjustmentFactor <= 0
  ) {
    return marketValue;
  }

  return Math.max(1, Math.round(marketValue * projectionAdjustmentFactor));
};

export interface RushingReceivingProjectionScoring {
  rushingYards: number;
  rushingTouchdown: number;
  receivingYards: number;
  receivingTouchdown: number;
  reception: number;
}

const rushingReceivingScoringKeys = [
  "rushingYards",
  "rushingTouchdown",
  "receivingYards",
  "receivingTouchdown",
  "reception",
] as const satisfies readonly (keyof RushingReceivingProjectionScoring)[];

export const projectionScoringMatches = (
  calibrationScoring: RushingReceivingProjectionScoring | undefined,
  leagueScoring: RushingReceivingProjectionScoring,
): boolean => calibrationScoring !== undefined
  && rushingReceivingScoringKeys.every(key => calibrationScoring[key] === leagueScoring[key]);

export interface StrategyAdjustedAuctionValueInput {
  marketValue: number;
  position: Position;
  strategyKey: LiveDraftStrategyKey;
  positionCount: number;
  starterCount: number;
  flexNeedsPlayer: boolean;
  maximumBid: number;
}

export const strategyAdjustedAuctionValue = ({
  marketValue,
  position,
  strategyKey,
  positionCount,
  starterCount,
  flexNeedsPlayer,
  maximumBid,
}: StrategyAdjustedAuctionValueInput): number => {
  const strategy: LiveDraftStrategyDefinition = liveDraftStrategies[strategyKey];
  let premium = positionCount < starterCount ? strategy.starterPremium[position] ?? 0 : 0;
  const anchorTarget = strategy.anchorTargets?.[position] ?? 0;
  if (positionCount < anchorTarget) premium += strategy.depthPremium[position] ?? 0;
  if (flexNeedsPlayer && (position === "RB" || position === "WR" || position === "TE")) {
    premium += Math.max(0, strategy.depthPremium[position] ?? 0);
  }
  if (position === "K" || position === "DST") premium += strategy.starterPremium[position] ?? -1;

  return Math.min(
    maximumBid,
    marketValue + 12,
    Math.max(1, Math.round(marketValue + premium)),
  );
};
