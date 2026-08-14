import { z } from "zod";

const offensivePositionSchema = z.enum(["QB", "RB", "WR", "TE"]);
const targetSchema = z.looseObject({
  playerName: z.string(),
  maxAuctionPrice: z.number().optional(),
  maxSnakeRound: z.number().optional(),
  maxSnakeOverallPick: z.number().optional(),
});
const preferredPositionSchema = z.looseObject({
  position: offensivePositionSchema,
  tier: z.literal("elite"),
  targetCount: z.number().optional(),
  maxAuctionPrice: z.number().optional(),
});
const positionCapSchema = z.looseObject({
  position: offensivePositionSchema,
  maxAuctionPrice: z.number(),
  excludeNamedTargets: z.boolean(),
});

export const parsedSeasonStrategySchema = z.looseObject({
  rawInput: z.string(),
  targets: z.array(targetSchema).optional(),
  target: targetSchema.optional(),
  preferredPositions: z.array(preferredPositionSchema),
  positionCaps: z.array(positionCapSchema).optional(),
  pairWithPlayerName: z.string().optional(),
  summary: z.string(),
  warnings: z.array(z.string()),
});
