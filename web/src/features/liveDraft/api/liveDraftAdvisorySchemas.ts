import { z } from "zod";

export const liveDraftMomentumSchema = z.enum(["rising", "falling", "steady"]);

export const liveDraftAdvisoryInjurySchema = z.object({
  headline: z.string().min(1),
  publishedAt: z.string().min(1),
});

export const liveDraftAdvisoryPlayerSchema = z.object({
  normalizedPlayerName: z.string().min(1),
  rankEcr: z.number().int().positive(),
  tier: z.number().int().positive().optional(),
  positionRank: z.string().min(1).optional(),
  momentum: liveDraftMomentumSchema,
  ecrDelta: z.number().int().optional(),
  injury: liveDraftAdvisoryInjurySchema.optional(),
});

export const liveDraftAdvisorySchema = z.object({
  configured: z.boolean(),
  basis: z.enum(["ros", "weekly"]),
  week: z.number().int().positive().nullable(),
  players: z.array(liveDraftAdvisoryPlayerSchema),
});

export type LiveDraftAdvisory = z.output<typeof liveDraftAdvisorySchema>;
export type LiveDraftAdvisoryInjury = z.output<typeof liveDraftAdvisoryInjurySchema>;
export type LiveDraftAdvisoryPlayer = z.output<typeof liveDraftAdvisoryPlayerSchema>;
export type LiveDraftMomentum = z.output<typeof liveDraftMomentumSchema>;
