import { z } from "zod";
import type { ForcedAuctionSale } from "../../modeling/mockBatch.js";
import type { SimulationResult } from "../simulations.js";
import { dateFromDb, requiredDateFromDb } from "./dates.js";
import { isRecord, jsonValueFromDb, numberFromRecord, stringFromRecord } from "./json.js";
import { mockSummaryFromDb } from "./mockSummaryCodec.js";
import { requestFromRow } from "./requestCodec.js";
import { seasonSimulationFromDb } from "./seasonResultCodec.js";
import type { SimulationRunRow } from "./types.js";

const forcedSaleSchema = z.looseObject({
  owner: z.string(), player: z.string(), price: z.number(),
});

const forcedSalesFromDb = (value: unknown): ForcedAuctionSale[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    const parsed = forcedSaleSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
};

const favoriteRunNumbersFromDb = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.flatMap(candidate =>
      typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0
        ? [candidate]
        : [])
    : [];

const completedAtFrom = (
  value: unknown,
  row: SimulationRunRow,
): Date => {
  const completedAt = value instanceof Date || typeof value === "string"
    ? dateFromDb(value)
    : dateFromDb(row.completed_at);
  return completedAt ?? requiredDateFromDb("created_at", row.created_at);
};

export const resultFromRow = (
  row: SimulationRunRow,
): SimulationResult | undefined => {
  if (row.result_set_json === undefined || row.result_set_json === null) return undefined;
  const resultJson = jsonValueFromDb(row.result_set_json);
  if (!isRecord(resultJson)) return undefined;
  const request = requestFromRow(row);
  const seasonSimulation = seasonSimulationFromDb(resultJson.seasonSimulation);
  return {
    runId: row.id,
    requestId: request.id,
    completedAt: completedAtFrom(resultJson.completedAt, row),
    runCount: numberFromRecord(resultJson, "runCount", request.count),
    seedPrefix: stringFromRecord(resultJson, "seedPrefix", request.seedPrefix),
    hardLockCount: numberFromRecord(
      resultJson, "hardLockCount", request.strategy.hardLocks.length,
    ),
    softTargetCount: numberFromRecord(
      resultJson, "softTargetCount", request.strategy.softTargets.length,
    ),
    forcedSales: forcedSalesFromDb(resultJson.forcedSales),
    summary: mockSummaryFromDb(resultJson.summary, request.count),
    ...(seasonSimulation === undefined ? {} : { seasonSimulation }),
    ...(typeof resultJson.strategyText === "string"
      ? { strategyText: resultJson.strategyText }
      : {}),
    ...(typeof resultJson.note === "string" ? { note: resultJson.note } : {}),
    favoriteRunNumbers: favoriteRunNumbersFromDb(resultJson.favoriteRunNumbers),
  };
};
