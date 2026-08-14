import type { Position } from "../../../../config/league.js";
import type { CalibrationPriceTier } from "../contracts/calibration.js";

export interface GateThresholds {
  warn: number;
  fail: number;
}

export const priceTierCountThresholds: Record<
  CalibrationPriceTier["key"],
  GateThresholds
> = {
  elite: { warn: 4, fail: 8 },
  strong: { warn: 5, fail: 10 },
  starter: { warn: 8, fail: 16 },
  depth: { warn: 20, fail: 40 },
  dollar: { warn: 20, fail: 45 },
};

export const positionSpendThresholds: Record<Position, GateThresholds> = {
  QB: { warn: 25, fail: 50 },
  RB: { warn: 50, fail: 100 },
  WR: { warn: 50, fail: 100 },
  TE: { warn: 25, fail: 60 },
  K: { warn: 10, fail: 20 },
  DST: { warn: 10, fail: 20 },
};

export const positionCountThresholds: Record<Position, GateThresholds> = {
  QB: { warn: 3, fail: 6 },
  RB: { warn: 8, fail: 16 },
  WR: { warn: 8, fail: 16 },
  TE: { warn: 4, fail: 8 },
  K: { warn: 3, fail: 6 },
  DST: { warn: 3, fail: 6 },
};
