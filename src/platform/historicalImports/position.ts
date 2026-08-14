import { positions, type Position } from "../../../config/league.js";

const isPosition = (value: string): value is Position =>
  positions.some(position => position === value);

export const resolveHistoricalPosition = (position: string | undefined): Position | null => {
  if (position === undefined) return null;

  const normalizedPosition = position.trim().toUpperCase();
  return isPosition(normalizedPosition) ? normalizedPosition : null;
};
