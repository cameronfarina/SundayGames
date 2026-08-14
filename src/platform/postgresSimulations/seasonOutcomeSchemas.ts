import { z } from "zod";

const targetReasonSchema = z.enum([
  "ambiguous_player_name",
  "insufficient_auction_budget",
  "insufficient_roster_slots",
  "player_not_found",
  "retained_by_other_team",
  "retained_by_your_team_above_max_price",
]);

export const targetOutcomeSchema = z.looseObject({
  playerId: z.string(),
  playerName: z.string(),
  status: z.enum(["hit", "miss", "infeasible"]),
  feasible: z.boolean(),
  hitCount: z.number(),
  hitRate: z.number(),
  reason: targetReasonSchema.optional(),
  message: z.string(),
});

const preferenceRuleSchema = z.looseObject({
  basis: z.enum(["auction_expected_value", "snake_catalog_rank"]),
  positionRankMaximum: z.number(),
  qualifyingPlayerIds: z.array(z.string()),
  minimumExpectedValue: z.number().optional(),
});

export const preferenceOutcomeSchema = z.looseObject({
  position: z.enum(["QB", "RB", "WR", "TE"]),
  tier: z.literal("elite"),
  targetCount: z.number(),
  status: z.enum(["hit", "miss", "infeasible"]),
  feasible: z.boolean(),
  hitCount: z.number(),
  hitRate: z.number(),
  rule: preferenceRuleSchema,
  message: z.string(),
});
