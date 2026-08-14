import { z } from "zod";

const strategySchema = z.object({
  preferredPositions: z.array(z.object({
    count: z.number().int().positive(),
    position: z.string(),
  })).default([]),
  rawInput: z.string(),
  summary: z.string(),
  warnings: z.array(z.string()),
});

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

const targetOutcomeSchema = z.object({
  hitCount: z.number().int().nonnegative(),
  hitRate: z.number().min(0).max(1),
  playerId: z.string(),
  playerName: z.string(),
});

export const simulationSchema = z.object({
  completedCount: z.number().int().nonnegative(),
  draftFormat: z.enum(["auction", "snake"]),
  playerExposure: z.array(z.object({
    averagePick: z.number().optional(),
    averagePrice: z.number().optional(),
    count: z.number().int().nonnegative(),
    playerId: z.string(),
    playerName: z.string(),
    position: z.string(),
    rate: z.number().min(0).max(1),
  })),
  positionCounts: z.record(z.string(), z.object({ perRun: z.number(), total: z.number() })),
  runCount: z.number().int().positive(),
  runs: z.array(z.object({
    label: z.string(),
    runNumber: z.number().int().positive(),
    seed: z.string(),
    teams: z.array(teamSchema),
  })),
  seedPrefix: z.string(),
  strategy: strategySchema,
  targetOutcome: targetOutcomeSchema.optional(),
  targetOutcomes: z.array(targetOutcomeSchema).optional(),
});

export const simulationHistoryItemSchema = z.object({
  completedAt: z.string().optional(),
  createdAt: z.string().optional(),
  id: z.string(),
  note: z.string().optional(),
  simulation: simulationSchema.pick({
    completedCount: true,
    draftFormat: true,
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
  simulation: simulationSchema,
});

export type PracticeSimulation = z.infer<typeof simulationSchema>;
export type SimulationHistoryItem = z.infer<typeof simulationHistoryItemSchema>;
