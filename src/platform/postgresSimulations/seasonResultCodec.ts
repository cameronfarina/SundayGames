import { z } from "zod";
import type { SeasonSimulationResult } from "../seasonSimulationEngine.js";
import { preferenceOutcomeSchema, targetOutcomeSchema } from "./seasonOutcomeSchemas.js";
import { parsedSeasonStrategySchema } from "./seasonStrategySchema.js";

const exposureSchema = z.looseObject({
  playerId: z.string(), playerName: z.string(), position: z.string(),
  count: z.number(), rate: z.number(), averagePrice: z.number().optional(),
  averagePick: z.number().optional(),
});
const positionCountSchema = z.looseObject({
  total: z.number(), perRun: z.number(),
});
const rosterPlayerSchema = z.looseObject({
  playerId: z.string(), playerName: z.string(), position: z.string(),
  source: z.enum(["ai", "human", "keeper"]),
  price: z.number().optional(), overallPick: z.number().optional(),
  round: z.number().optional(), rosterSlot: z.string(), starter: z.boolean(),
  week1Points: z.number(),
});
const teamSchema = z.looseObject({
  teamId: z.string(), teamName: z.string(), isUserTeam: z.boolean(),
  roster: z.array(rosterPlayerSchema), week1Points: z.number(),
  spent: z.number().optional(), budgetRemaining: z.number().optional(),
});
const runSchema = z.looseObject({
  runNumber: z.number(), label: z.string(), seed: z.string(),
  teams: z.array(teamSchema),
});
const seasonSimulationSchema = z.looseObject({
  draftFormat: z.enum(["auction", "snake"]),
  runCount: z.number(),
  completedCount: z.number(),
  seedPrefix: z.string(),
  strategy: parsedSeasonStrategySchema,
  targetOutcomes: z.array(targetOutcomeSchema).optional(),
  targetOutcome: targetOutcomeSchema.optional(),
  preferenceOutcomes: z.array(preferenceOutcomeSchema).optional(),
  playerExposure: z.array(exposureSchema),
  positionCounts: z.record(z.string(), positionCountSchema),
  runs: z.array(runSchema),
});

export const seasonSimulationFromDb = (
  value: unknown,
): SeasonSimulationResult | undefined => {
  const parsed = seasonSimulationSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};
