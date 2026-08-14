import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRanking } from "../projectionRankings.js";
import type { PricingConfig } from "./contracts.js";
import { clamp, roundToTwo } from "./math.js";

export type HistoricalAuctionRecordsByName = ReadonlyMap<
  string,
  readonly HistoricalAuctionRecord[]
>;

export interface HistoricalRoomPricePrior {
  historicalAuctionCount: number;
  historicalRoomPrice: number;
  historicalRoomFloor: number;
  historicalRoomFloorShare: number;
}

const emptyPrior = (): HistoricalRoomPricePrior => ({
  historicalAuctionCount: 0,
  historicalRoomPrice: 0,
  historicalRoomFloor: 0,
  historicalRoomFloorShare: 0,
});

export const buildHistoricalAuctionRecordsByName = (
  records: readonly HistoricalAuctionRecord[],
  config: PricingConfig,
): HistoricalAuctionRecordsByName => {
  if (!config.historicalPricePrior.enabled) return new Map();
  const byName = new Map<string, HistoricalAuctionRecord[]>();
  for (const record of records) {
    if (record.acquisitionType !== "auction") continue;
    if (record.price < config.historicalPricePrior.minimumHistoricalPrice) continue;
    const entries = byName.get(record.normalizedPlayerName) ?? [];
    entries.push(record);
    byName.set(record.normalizedPlayerName, entries);
  }
  return byName;
};

const weightedHistoricalPrice = (
  records: readonly HistoricalAuctionRecord[],
  recencyDecay: number,
): number => {
  const maxSeason = Math.max(...records.map(record => record.season));
  const weighted = records.reduce(
    (totals, record) => {
      const weight = recencyDecay ** (maxSeason - record.season);
      return {
        weight: totals.weight + weight,
        price: totals.price + record.price * weight,
      };
    },
    { weight: 0, price: 0 },
  );
  return roundToTwo(weighted.price / Math.max(0.000001, weighted.weight));
};

export const historicalRoomPricePriorFor = (
  ranking: ProjectionRanking,
  recordsByName: HistoricalAuctionRecordsByName,
  contextAdjustmentPercent: number,
  config: PricingConfig,
): HistoricalRoomPricePrior => {
  const records = (recordsByName.get(ranking.normalizedName) ?? [])
    .filter(record => record.position === ranking.position);
  if (records.length === 0) return emptyPrior();
  const qualifies =
    (ranking.espnAuctionValue ?? 0) >=
      config.historicalPricePrior.minimumCurrentAnchorValue ||
    (ranking.espnRank ?? Number.MAX_SAFE_INTEGER) <=
      config.historicalPricePrior.maximumCurrentEspnRank;
  if (!qualifies) return emptyPrior();
  const historicalRoomPrice = weightedHistoricalPrice(
    records,
    config.historicalPricePrior.recencyDecay,
  );
  const baseShare = records.length === 1
    ? config.historicalPricePrior.singleSeasonFloorShare
    : config.historicalPricePrior.multiSeasonFloorShare;
  const rankBoost = ranking.espnRank === undefined
    ? 0
    : clamp(
      (ranking.espnRank - ranking.projectionRank) *
        config.historicalPricePrior.projectionRankBoostPerRank,
      0,
      config.historicalPricePrior.maxProjectionRankBoost,
    );
  const contextPenalty = clamp(
    Math.max(0, -contextAdjustmentPercent) *
      config.historicalPricePrior.negativeContextPenaltyMultiplier,
    0,
    config.historicalPricePrior.maxNegativeContextPenalty,
  );
  const floorShare = clamp(baseShare + rankBoost - contextPenalty, 0, 1);
  return {
    historicalAuctionCount: records.length,
    historicalRoomPrice,
    historicalRoomFloor: Math.round(historicalRoomPrice * floorShare),
    historicalRoomFloorShare: roundToTwo(floorShare),
  };
};
