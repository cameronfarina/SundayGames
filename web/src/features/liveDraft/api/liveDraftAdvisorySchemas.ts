import { z } from "zod";

export const liveDraftMomentumSchema = z.enum(["rising", "falling", "steady"]);

export const liveDraftAdvisoryPlayerSchema = z.object({
  normalizedPlayerName: z.string().min(1),
  rankEcr: z.number().int().positive(),
  tier: z.number().int().positive().optional(),
  positionRank: z.string().min(1).optional(),
  momentum: liveDraftMomentumSchema,
  ecrDelta: z.number().int().optional(),
});

export const liveDraftAdvisorySchema = z.object({
  configured: z.boolean(),
  basis: z.enum(["ros", "weekly"]),
  week: z.number().int().positive().nullable(),
  players: z.array(liveDraftAdvisoryPlayerSchema),
});

export type LiveDraftAdvisory = z.output<typeof liveDraftAdvisorySchema>;
export type LiveDraftAdvisoryPlayer = z.output<typeof liveDraftAdvisoryPlayerSchema>;
export type LiveDraftMomentum = z.output<typeof liveDraftMomentumSchema>;
