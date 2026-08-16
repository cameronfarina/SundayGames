import { z } from "zod";
import { positionSchema, strategySchema, targetOutcomeSchema } from "./simulationStrategySchema";

const rosterPlayerSchema = z.object({
  overallPick: z.number().int().positive().optional(),
  playerId: z.string(),
  playerName: z.string(),
  position: z.string(),
  price: z.number().nonnegative().optional(),
  rosterSlot: z.string(),
  round: z.number().int().positive().optional(),
  source: z.enum(["ai", "human", "keeper"]),
  starter: z.boolean(),
  week1Points: z.number(),
});

const teamSchema = z.object({
  budgetRemaining: z.number().optional(),
  isUserTeam: z.boolean(),
  roster: z.array(rosterPlayerSchema),
  spent: z.number().optional(),
  teamId: z.string(),
  teamName: z.string(),
  week1Points: z.number(),
});

export const simulationOutcomeSchema = z.object({
  favorite: z.boolean(),
  rank: z.number().int().positive(),
  runNumber: z.number().int().positive(),
  userWeek1Points: z.number(),
});

export const simulationSummarySchema = z.object({
  completedCount: z.number().int().nonnegative(),
  draftFormat: z.enum(["auction", "snake"]),
  outcomes: z.array(simulationOutcomeSchema).default([]),
  playerExposure: z.array(z.object({
    averagePick: z.number().optional(),
    averagePrice: z.number().optional(),
    count: z.number().int().nonnegative(),
    playerId: z.string(),
    playerName: z.string(),
    position: z.string(),
    rate: z.number().min(0).max(1),
  })),
  preferenceOutcomes: z.array(z.object({
    feasible: z.boolean(),
    hitCount: z.number().int().nonnegative(),
    hitRate: z.number().min(0).max(1),
    message: z.string(),
    position: positionSchema,
    rule: z.object({
      basis: z.enum(["auction_expected_value", "snake_catalog_rank"]),
      minimumExpectedValue: z.number().optional(),
      positionRankMaximum: z.number().int().positive(),
      qualifyingPlayerIds: z.array(z.string()),
    }),
    status: z.enum(["hit", "miss", "infeasible"]),
    targetCount: z.number().int().positive(),
    tier: z.literal("elite"),
  })).optional(),
  positionCounts: z.record(z.string(), z.object({ perRun: z.number(), total: z.number() })),
  runCount: z.number().int().positive(),
  seedPrefix: z.string(),
  strategy: strategySchema,
  targetOutcome: targetOutcomeSchema.optional(),
  targetOutcomes: z.array(targetOutcomeSchema).optional(),
});

export const simulationRunSchema = z.object({
  label: z.string(),
  runNumber: z.number().int().positive(),
  seed: z.string(),
  teams: z.array(teamSchema),
});

export const simulationHistoryItemSchema = z.object({
  completedAt: z.string().optional(),
  createdAt: z.string().optional(),
  id: z.string(),
  note: z.string().optional(),
  simulation: simulationSummarySchema.pick({
    completedCount: true,
    draftFormat: true,
    outcomes: true,
    runCount: true,
    strategy: true,
    targetOutcome: true,
    targetOutcomes: true,
  }),
  strategyText: z.string().optional(),
});

export const simulationResponseSchema = z.object({
  historyId: z.string(),
  note: z.string().optional(),
  summary: simulationSummarySchema,
});

export const simulationRunResponseSchema = z.object({
  historyId: z.string(),
  run: simulationRunSchema,
});

export const simulationOutcomeResponseSchema = z.object({
  historyId: z.string(),
  outcome: simulationOutcomeSchema,
});

export const simulationProgressSchema = z.object({
  completed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
}).refine(progress => progress.completed <= progress.total);

export type PracticeSimulationRun = z.infer<typeof simulationRunSchema>;
export type PracticeSimulationSummary = z.infer<typeof simulationSummarySchema>;
export type SimulationProgress = z.infer<typeof simulationProgressSchema>;
export type SimulationHistoryItem = z.infer<typeof simulationHistoryItemSchema>;
