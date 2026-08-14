import { z } from "zod";

const roleSchema = z.enum(["owner", "admin", "member", "observer"]);

export const onboardingSchema = z.object({
  account: z.object({ id: z.string(), email: z.string() }),
  leagues: z.array(z.object({
    leagueId: z.string(),
    leagueName: z.string(),
    seasonId: z.string(),
    seasonYear: z.number(),
    membership: z.object({
      role: roleSchema,
      ownerId: z.string().optional(),
      teamId: z.string().optional(),
      ownerDisplayName: z.string().optional(),
      teamDisplayName: z.string().optional(),
    }),
    canManageLeague: z.boolean(),
    readiness: z.object({
      leagueSetup: z.enum(["ready", "needs_attention"]),
      teamClaim: z.enum(["ready", "needs_attention"]),
      liveDraft: z.enum(["ready", "needs_attention"]),
    }),
    nextDraftAt: z.string().optional(),
    liveDraft: z.object({ roomId: z.string(), status: z.string() }).nullable(),
  })),
});

export const keeperSchema = z.object({
  teamId: z.string(),
  playerId: z.string().optional(),
  playerName: z.string(),
  position: z.string(),
  price: z.number(),
  keeperRound: z.number().optional(),
});

export const keepersResponseSchema = z.object({ keepers: z.array(keeperSchema) });

export const keeperMutationResponseSchema = keepersResponseSchema.extend({
  preview: z.object({
    team: z.object({ name: z.string() }),
    player: z.object({ name: z.string() }),
    keeper: z.object({
      draftType: z.enum(["auction", "snake"]),
      auctionCostDollars: z.number().optional(),
      keeperRound: z.number().optional(),
    }),
  }).optional(),
  room: z.object({ roomId: z.string() }).optional(),
});

export const invitationSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  kind: z.enum(["league", "team"]),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  expiresAt: z.string(),
  acceptPath: z.string().optional(),
});

export const invitationsResponseSchema = z.object({
  invitations: z.array(invitationSchema),
  claimedTeamIds: z.array(z.string()),
});

export const invitationMutationResponseSchema = z.object({ invitation: invitationSchema });

export const roomResponseSchema = z.object({
  room: z.object({
    roomId: z.string(),
    status: z.enum(["setup", "countdown", "live", "paused", "ended"]),
    startsAt: z.string().optional(),
  }),
});

export const okResponseSchema = z.object({ ok: z.literal(true) });

export type CommissionerLeague = z.infer<typeof onboardingSchema>["leagues"][number];
export type CommissionerKeeper = z.infer<typeof keeperSchema>;
export type CommissionerInvitation = z.infer<typeof invitationSchema>;
