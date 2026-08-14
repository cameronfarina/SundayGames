import type { Position } from "../../../config/league.js";

const positionValues: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const cleanCell = (value: string | undefined): string =>
  (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export const parsePrice = (value: string | undefined): number | undefined => {
  const cleaned = cleanCell(value).replace(/\$/g, "").replace(/,/g, "");
  if (!cleaned) return undefined;

  const price = Number(cleaned);
  if (!Number.isInteger(price)) throw new Error(`Invalid auction price: ${value ?? ""}`);

  return price;
};

const isPosition = (value: string): value is Position =>
  positionValues.some(position => position === value);

export const normalizePosition = (value: string | undefined): Position | undefined => {
  const position = cleanCell(value).replace("DEF", "DST");
  if (!isPosition(position)) return undefined;

  return position;
};
