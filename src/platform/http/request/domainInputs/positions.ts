import { positions, type Position } from "../../../../../config/league.js";

export const isPosition = (value: unknown): value is Position =>
  positions.some(position => position === value);
