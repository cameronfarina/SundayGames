import type { HistoricalSaleRecord } from "../historicalImports.js";
import { isSlotPriceSaleRecord } from "../historicalImports/slotPriceProvenance.js";
import type { PricingSourcePrice } from "../pricingSnapshots.js";
import { flatPricedPositions } from "./constants.js";
import type { CreateLeagueCalibratedPricingSnapshotsInput } from "./contracts.js";
import { addMapValue, average } from "./helpers.js";

const slotRankPattern = /(\d+)$/u;

const slotKey = (position: string, rank: number): string =>
  `${position}\0${String(rank)}`;

// Deep slots carry no published value and cheap slots fall under the counted
// minimum, yet both still say what this league pays for a rank, so floors
// keep records that the inflation number has to drop.
export const slotFloorRecords = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly HistoricalSaleRecord[] => {
  const currentSeasonYear = Number(input.seasonYear);
  return input.historicalSaleRecords.filter(record =>
    record.leagueId === input.leagueId
    && isSlotPriceSaleRecord(record)
    && !flatPricedPositions.has(record.position)
    && (!Number.isFinite(currentSeasonYear) || record.seasonYear <= currentSeasonYear)
    && Number.isFinite(record.priceDollars)
    && record.priceDollars > 0);
};

const slotFloorTable = (
  records: readonly HistoricalSaleRecord[],
): Map<string, number> => {
  const slotPrices = new Map<string, number[]>();
  for (const record of records) {
    const rank = Number(slotRankPattern.exec(record.playerName)?.[1]);
    if (Number.isInteger(rank) && rank >= 1) {
      addMapValue(slotPrices, slotKey(record.position, rank), record.priceDollars);
    }
  }
  return new Map([...slotPrices]
    .map(([key, prices]) => [key, average(prices) ?? 0]));
};

// The sheet prices a rank, not a name, so this year's board only decides who
// fills each slot: within a position the highest baseline price takes rank one.
export const slotFloorByBaselineIndex = (
  baselinePrices: readonly PricingSourcePrice[],
  records: readonly HistoricalSaleRecord[],
): ReadonlyMap<number, number> => {
  const floors = new Map<number, number>();
  const table = slotFloorTable(records);
  if (table.size === 0) return floors;
  const indexesByPosition = new Map<string, number[]>();
  baselinePrices.forEach((price, index) => {
    addMapValue(indexesByPosition, price.position, index);
  });
  for (const [position, indexes] of indexesByPosition) {
    [...indexes]
      .sort((left, right) =>
        (baselinePrices[right]?.price ?? 0) - (baselinePrices[left]?.price ?? 0))
      .forEach((baselineIndex, rankIndex) => {
        const floor = table.get(slotKey(position, rankIndex + 1));
        if (floor !== undefined) floors.set(baselineIndex, floor);
      });
  }
  return floors;
};
