import { z } from "zod";
import type { MockBatchSummary } from "../../modeling/mockBatch.js";
import { isRecord } from "./json.js";

const positionSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DST"]);
const positionAmountsSchema = z.looseObject({
  QB: z.number(), RB: z.number(), WR: z.number(),
  TE: z.number(), K: z.number(), DST: z.number(),
});
const scenarioSchema = z.looseObject({
  key: z.enum(["confirmedOnly", "expected", "highRetention"]),
  label: z.string(),
  runCount: z.number(),
  invalidRosterCount: z.number(),
  averagePickCount: z.number(),
});
const playerSchema = z.looseObject({
  name: z.string(), position: positionSchema, draftedCount: z.number(),
  draftedRate: z.number(), averageMarketPrice: z.number(),
  averageSalePrice: z.number(), minimumSalePrice: z.number(),
  maximumSalePrice: z.number(),
});
const ownerSchema = z.looseObject({
  owner: z.string(), runCount: z.number(), invalidRosterCount: z.number(),
  averageSpend: z.number(), minimumSpend: z.number(), maximumSpend: z.number(),
  averageWeek1Score: z.number(), averageWeeks1To4Score: z.number(),
  averageBudgetRemaining: z.number(), averagePositionSpend: positionAmountsSchema,
});
const exposureSchema = z.looseObject({
  owner: z.string(), player: z.string(), position: positionSchema,
  draftedCount: z.number(), draftedRate: z.number(), averagePrice: z.number(),
});
const summarySchema = z.looseObject({
  runCount: z.number(),
  scenarios: z.array(scenarioSchema),
  players: z.array(playerSchema),
  owners: z.array(ownerSchema),
  ownerPlayerExposure: z.array(exposureSchema),
});

const emptySummary = (runCount: number): MockBatchSummary => ({
  runCount,
  scenarios: [],
  players: [],
  owners: [],
  ownerPlayerExposure: [],
});

export const mockSummaryFromDb = (
  value: unknown,
  fallbackRunCount: number,
): MockBatchSummary => {
  if (!isRecord(value)) return emptySummary(fallbackRunCount);
  const parsed = summarySchema.safeParse(value);
  return parsed.success ? parsed.data : emptySummary(fallbackRunCount);
};
