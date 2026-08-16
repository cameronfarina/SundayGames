import { z } from "zod";

export const positionSchema = z.enum(["QB", "RB", "WR", "TE"]);

const targetConstraintSchema = z.object({
  maxAuctionPrice: z.number().nonnegative().optional(),
  maxSnakeOverallPick: z.number().int().positive().optional(),
  maxSnakeRound: z.number().int().positive().optional(),
  playerName: z.string(),
});

const preferredPositionSchema = z.object({
  maxAuctionPrice: z.number().nonnegative().optional(),
  position: positionSchema,
  targetCount: z.number().int().positive().optional(),
  tier: z.literal("elite"),
});

export const strategySchema = z.object({
  pairWithPlayerName: z.string().optional(),
  positionCaps: z.array(z.object({
    excludeNamedTargets: z.boolean(),
    maxAuctionPrice: z.number().nonnegative(),
    position: positionSchema,
  })).optional(),
  preferredPositions: z.array(preferredPositionSchema).default([]),
  rawInput: z.string(),
  summary: z.string(),
  target: targetConstraintSchema.optional(),
  targets: z.array(targetConstraintSchema).optional(),
  warnings: z.array(z.string()),
});

export const targetOutcomeSchema = z.object({
  feasible: z.boolean().optional(),
  hitCount: z.number().int().nonnegative(),
  hitRate: z.number().min(0).max(1),
  message: z.string().optional(),
  playerId: z.string(),
  playerName: z.string(),
  reason: z.enum([
    "ambiguous_player_name",
    "insufficient_auction_budget",
    "insufficient_roster_slots",
    "player_not_found",
    "retained_by_other_team",
    "retained_by_your_team_above_max_price",
  ]).optional(),
  status: z.enum(["hit", "miss", "infeasible"]).optional(),
});
