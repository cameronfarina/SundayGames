import type { HistoricalSaleRecord } from "../historicalImports.js";
import {
  arrayValue,
  booleanValue,
  numberValue,
  optionalNumberValue,
  positionValue,
  recordValue,
  stringValue,
} from "./primitives.js";
import { invalidWorkerMessage } from "./errors.js";

const acquisitionTypeValue = (
  value: unknown,
): HistoricalSaleRecord["acquisitionType"] => {
  if (value === "auction" || value === "keeper") return value;
  return invalidWorkerMessage();
};

const historicalSaleValue = (value: unknown): HistoricalSaleRecord => {
  const record = recordValue(value);
  const publicPriceDollars = optionalNumberValue(record.publicPriceDollars);
  return {
    id: stringValue(record.id),
    batchId: stringValue(record.batchId),
    leagueId: stringValue(record.leagueId),
    leagueSeasonId: stringValue(record.leagueSeasonId),
    seasonYear: numberValue(record.seasonYear),
    rowNumber: numberValue(record.rowNumber),
    ownerId: stringValue(record.ownerId),
    ownerDisplayName: stringValue(record.ownerDisplayName),
    playerId: stringValue(record.playerId),
    playerName: stringValue(record.playerName),
    position: positionValue(record.position),
    priceDollars: numberValue(record.priceDollars),
    ...(publicPriceDollars === undefined ? {} : { publicPriceDollars }),
    keeper: booleanValue(record.keeper),
    acquisitionType: acquisitionTypeValue(record.acquisitionType),
  };
};

export const historicalSalesValue = (
  value: unknown,
): readonly HistoricalSaleRecord[] => arrayValue(value).map(historicalSaleValue);
