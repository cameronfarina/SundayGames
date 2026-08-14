import type { PositionAmounts } from "./contracts.js";

export const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const roundedTotal = (amounts: PositionAmounts): number =>
  Math.round(Object.values(amounts).reduce((total, amount) => total + amount, 0));

export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
