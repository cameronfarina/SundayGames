import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { CreateLeagueCalibratedPricingSnapshotsInput } from "./contracts.js";
import { normalizePlayerName } from "./helpers.js";

const historicalRecordHashInput = (record: HistoricalSaleRecord) => ({
  id: record.id,
  batchId: record.batchId,
  leagueId: record.leagueId,
  leagueSeasonId: record.leagueSeasonId,
  seasonYear: record.seasonYear,
  rowNumber: record.rowNumber,
  ownerId: record.ownerId,
  playerId: record.playerId,
  normalizedName: normalizePlayerName(record.playerName),
  position: record.position,
  priceDollars: record.priceDollars,
  publicPriceDollars: record.publicPriceDollars,
  keeper: record.keeper,
  acquisitionType: record.acquisitionType,
});

const historicalRecordSortKey = (record: HistoricalSaleRecord): string => [
  record.leagueId,
  String(record.seasonYear),
  record.id,
  record.batchId,
  String(record.rowNumber),
  record.playerId,
  normalizePlayerName(record.playerName),
  record.position,
  String(record.priceDollars),
].join("\0");

export const inputSnapshotPayload = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  historicalSaleRecords: readonly HistoricalSaleRecord[],
) => ({
  service: "league-calibrated-pricing-rebuild",
  leagueId: input.leagueId,
  seasonYear: input.seasonYear,
  modelVersion: input.modelVersion,
  baselinePrices: input.baselinePrices,
  historicalSaleRecords: [...historicalSaleRecords]
    .sort((left, right) =>
      historicalRecordSortKey(left).localeCompare(historicalRecordSortKey(right)))
    .map(historicalRecordHashInput),
  currentAuctionBudget: input.currentAuctionBudget,
  currentTeamCount: input.currentTeamCount,
  currentRosterSize: input.currentRosterSize,
  currentMinimumBidDollars: input.currentMinimumBidDollars,
  currentKeeperCount: input.currentKeeperCount,
  keeperLockedSpend: input.keeperLockedSpend,
  currentKeepers: input.currentKeepers === undefined ? undefined : [...input.currentKeepers]
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName)),
});
