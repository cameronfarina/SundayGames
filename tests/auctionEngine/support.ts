import { positions, type Position } from "../../config/league.js";
import type { ProjectionRecord } from "../../src/projections.js";
import type { Player } from "../../src/types.js";

export const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
export const fullMockReplacementBuffer = 160;

export const positionAmounts = (value: number): Record<Position, number> =>
  positions.reduce<Record<Position, number>>(
    (amounts, position) => ({ ...amounts, [position]: value }),
    { QB: value, RB: value, WR: value, TE: value, K: value, DST: value },
  );

export const player = (name: string, position: Position, price: number, weeks1To4 = price): Player => ({
  name,
  position,
  price,
  week1: weeks1To4 / 4,
  weeks1To4,
});

export const projection = (
  id: number,
  name: string,
  position: Position,
  weeks1To4: number,
  seasonProjection = weeks1To4 * 4,
): ProjectionRecord => ({
  id,
  name,
  position,
  weeks: { 1: weeks1To4 },
  weeks1To4,
  seasonProjection,
});

export const defined = <Value>(value: Value | null | undefined, message: string): Value => {
  if (value === null || value === undefined) throw new Error(message);
  return value;
};
