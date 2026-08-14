import type { NormalizedHistoricalImportRow } from "./playerContracts.js";

export const normalizePlayerId = (playerId: string | undefined): string | null => {
  const normalizedPlayerId = playerId?.trim() ?? "";
  return normalizedPlayerId.length > 0 ? normalizedPlayerId : null;
};

export const playerIdFromRow = (row: NormalizedHistoricalImportRow): string | null => {
  if (row.playerResolution?.status === "resolved") {
    return normalizePlayerId(row.playerResolution.playerId);
  }
  return normalizePlayerId(row.playerId);
};

const sanitizeIdSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const historicalImportBatchBaseId = (
  leagueId: string,
  seasonYear: number,
  fileHash: string,
): string => `historical-import-${sanitizeIdSegment(leagueId)}-${seasonYear}-${sanitizeIdSegment(fileHash)}`;

export const historicalImportSeasonKey = (
  leagueId: string,
  seasonYear: number,
): string => `${leagueId}:${seasonYear}`;
