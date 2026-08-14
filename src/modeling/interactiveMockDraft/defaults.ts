import { primaryOwner, type Owner, type Position } from "../../../config/league.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";

export type PositionAmounts = Record<Position, number>;

export const defaultScenarioKey: KeeperScenarioKey = "expected";
export const defaultWatchOwner: Owner = primaryOwner;
export const defaultSeed = "live-ui";
export const replacementDepthBuffer = 160;
export const topTargetLimit = 500;
export const topBidLimit = 5;

export const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
