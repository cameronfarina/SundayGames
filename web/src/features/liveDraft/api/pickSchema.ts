import { z } from "zod";

export const liveDraftPickSchema = z.object({
  overall: z.number().int().positive(),
  round: z.number().int().positive(),
  pickInRound: z.number().int().positive(),
  teamId: z.string().min(1),
  ownerDisplayName: z.string().min(1),
  teamDisplayName: z.string().min(1),
  playerName: z.string().min(1).optional(),
  source: z.enum(["keeper", "imported", "sale"]).optional(),
  saleEventId: z.string().min(1).optional(),
});

export type LiveDraftPick = z.infer<typeof liveDraftPickSchema>;
