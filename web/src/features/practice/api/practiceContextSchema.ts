import { z } from "zod";

const membershipSchema = z.object({
  ownerDisplayName: z.string().optional(),
  ownerId: z.string().optional(),
  role: z.string(),
  teamDisplayName: z.string().optional(),
  teamId: z.string().optional(),
});

export const practiceLeagueSchema = z.object({
  canManageLeague: z.boolean(),
  leagueId: z.string(),
  leagueName: z.string(),
  liveDraft: z.object({ roomId: z.string(), status: z.string() }).nullable(),
  membership: membershipSchema,
  nextDraftAt: z.string().optional(),
  readiness: z.object({
    leagueSetup: z.enum(["ready", "needs_attention"]),
    liveDraft: z.enum(["ready", "needs_attention"]),
    teamClaim: z.enum(["ready", "needs_attention"]),
  }),
  seasonId: z.string(),
  seasonYear: z.number().int(),
});

export const practiceContextSchema = z.object({
  account: z.object({ email: z.email(), id: z.string() }),
  leagues: z.array(practiceLeagueSchema),
});

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

export type PracticeContext = z.infer<typeof practiceContextSchema>;
export type PracticeLeague = z.infer<typeof practiceLeagueSchema>;
export type PracticeShortlistItem = z.infer<typeof practiceShortlistItemSchema>;
