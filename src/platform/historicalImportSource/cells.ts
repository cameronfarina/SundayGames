import type { HistoricalAcquisitionType } from "../historicalImports.js";
import {
  falseyKeeperValues,
  historicalPositions,
  integerCellPattern,
  truthyKeeperValues,
} from "./constants.js";

export const cleanCell = (value: string | undefined): string =>
  (value ?? "").replace(/\u00a0/gu, " ").trim();

export const normalizeHeader = (value: string): string =>
  cleanCell(value).toLowerCase().replace(/[^a-z0-9]+/gu, "");

export const parseIntegerCell = (value: string): number | undefined => {
  const cleaned = cleanCell(value);
  if (cleaned.length === 0 || !integerCellPattern.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

export const parsePriceDollars = (value: string): number | undefined =>
  parseIntegerCell(cleanCell(value).replace(/\$/gu, "").replace(/,/gu, ""));

export const normalizeHistoricalPosition = (value: string): string => {
  const cleaned = cleanCell(value);
  return cleaned.toUpperCase() === "DEF" ? "DST" : cleaned;
};

export const wideAuctionPosition = (value: string | undefined): string | null => {
  const normalized = cleanCell(value).toUpperCase();
  if (!historicalPositions.has(normalized)) return null;
  return normalized === "DEF" ? "DST" : normalized;
};

export const parseKeeper = (value: string): boolean | undefined => {
  const normalized = cleanCell(value).toLowerCase();
  if (normalized.length === 0) return undefined;
  if (truthyKeeperValues.has(normalized)) return true;
  if (falseyKeeperValues.has(normalized)) return false;
  return undefined;
};

export const parseAcquisitionType = (
  value: string,
): HistoricalAcquisitionType | undefined => {
  const normalized = cleanCell(value).toLowerCase();
  if (normalized === "auction" || normalized === "keeper") return normalized;
  return undefined;
};
