import { z } from "zod";

const membershipRoleSchema = z.enum(["owner", "admin", "member", "observer"]);
const readinessSchema = z.enum(["ready", "needs_attention"]);
const roomStatusSchema = z.enum(["setup", "countdown", "live", "paused", "ended"]);

export const onboardingLeagueSchema = z.object({
  canManageLeague: z.boolean(),
  leagueId: z.string(),
  leagueName: z.string(),
  leagueSlug: z.string(),
  liveDraft: z.object({
    roomId: z.string(),
    status: roomStatusSchema,
  }).nullable(),
  membership: z.object({
    ownerDisplayName: z.string().optional(),
    ownerId: z.string().optional(),
    role: membershipRoleSchema,
    teamDisplayName: z.string().optional(),
    teamId: z.string().optional(),
  }),
  nextDraftAt: z.string().optional(),
  readiness: z.object({
    leagueSetup: readinessSchema,
    liveDraft: readinessSchema,
    teamClaim: readinessSchema,
  }),
  seasonId: z.string(),
  seasonYear: z.number().int(),
});

export const onboardingSchema = z.object({
  account: z.object({ email: z.email(), id: z.string() }),
  leagues: z.array(onboardingLeagueSchema),
});

export type Onboarding = z.output<typeof onboardingSchema>;
export type OnboardingLeague = z.output<typeof onboardingLeagueSchema>;
