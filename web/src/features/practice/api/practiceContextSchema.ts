import { z } from "zod";

export const practiceShortlistItemSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  leagueId: z.string(),
  maxBid: z.number().int().nonnegative().optional(),
  playerName: z.string(),
  position: z.string(),
  priority: z.number().int().positive(),
  seasonId: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
});

export const practiceShortlistSchema = z.object({
  items: z.array(practiceShortlistItemSchema),
});

export type PracticeShortlistItem = z.infer<typeof practiceShortlistItemSchema>;
