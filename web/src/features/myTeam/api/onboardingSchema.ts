import { z } from "zod";

const readinessSchema = z.enum(["ready", "needs_attention"]);

export const onboardingLeagueSchema = z.object({
  leagueId: z.string(),
  leagueName: z.string(),
  seasonId: z.string(),
  seasonYear: z.number().int(),
  membership: z.object({
    role: z.enum(["owner", "admin", "member", "observer"]),
    ownerId: z.string().optional(),
    teamId: z.string().optional(),
    ownerDisplayName: z.string().optional(),
    teamDisplayName: z.string().optional(),
  }),
  canManageLeague: z.boolean(),
  readiness: z.object({
    leagueSetup: readinessSchema,
    teamClaim: readinessSchema,
    liveDraft: readinessSchema,
  }),
  nextDraftAt: z.string().optional(),
  liveDraft: z.object({
    roomId: z.string(),
    status: z.enum(["setup", "countdown", "live", "paused", "ended"]),
  }).nullable(),
});

export const onboardingSchema = z.object({
  account: z.object({ id: z.string(), email: z.email() }),
  leagues: z.array(onboardingLeagueSchema),
});

export type Onboarding = z.output<typeof onboardingSchema>;
export type OnboardingLeague = z.output<typeof onboardingLeagueSchema>;
