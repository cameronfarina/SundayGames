import { z } from "zod";
import { leagueSeasonSettingsSchema } from "./seasonSchemas";

const roleSchema = z.enum(["owner", "admin", "member", "observer"]);
const readinessSchema = z.enum(["ready", "needs_attention"]);

export const onboardingLeagueSchema = z.object({
  leagueId: z.string(),
  leagueName: z.string(),
  seasonId: z.string(),
  seasonYear: z.number().int(),
  membership: z.object({
    role: roleSchema,
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
    status: z.string(),
  }).nullable(),
});

export const leagueOnboardingSchema = z.object({
  account: z.object({ id: z.string(), email: z.email() }),
  leagues: z.array(onboardingLeagueSchema),
});

export const fantasyTeamSchema = z.object({
  id: z.string(),
  leagueSeasonId: z.string(),
  ownerId: z.string(),
  ownerDisplayName: z.string(),
  managerDisplayNames: z.array(z.string()).optional(),
  abbreviation: z.string().optional(),
  displayName: z.string(),
  draftOrderPosition: z.number().int().positive(),
});

export const leagueSeasonSchema = z.object({
  id: z.string(),
  league: z.object({
    id: z.string(),
    externalLeagueId: z.string(),
    name: z.string(),
    provider: z.enum(["mockd", "espn", "sleeper", "yahoo"]),
  }),
  leagueId: z.string(),
  seasonYear: z.number().int(),
  teams: z.array(fantasyTeamSchema),
  settings: leagueSeasonSettingsSchema,
  setupStatus: z.enum(["draft", "published", "locked"]),
  draft: z.object({
    scheduledAt: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
});

export const leagueSeasonResponseSchema = z.object({
  season: leagueSeasonSchema,
  claimableTeams: z.array(fantasyTeamSchema),
});

export const keeperSchema = z.object({
  teamId: z.string(),
  playerId: z.string().optional(),
  playerName: z.string(),
  position: z.enum(["QB", "RB", "WR", "TE", "K", "DST"]),
  price: z.number().nonnegative(),
  keeperRound: z.number().int().positive().optional(),
  expectedPrice: z.number().optional(),
  source: z.literal("keeper").optional(),
});

export const seasonKeepersResponseSchema = z.object({
  keepers: z.array(keeperSchema),
});

export const membershipSchema = z.object({
  userId: z.string(),
  leagueId: z.string(),
  role: roleSchema,
  ownerId: z.string().optional(),
  teamId: z.string().optional(),
});

export const teamClaimResponseSchema = z.object({ membership: membershipSchema });

export type LeagueOnboarding = z.infer<typeof leagueOnboardingSchema>;
export type OnboardingLeague = z.infer<typeof onboardingLeagueSchema>;
export type LeagueSeason = z.infer<typeof leagueSeasonSchema>;
export type FantasyTeam = z.infer<typeof fantasyTeamSchema>;
export type SeasonKeeper = z.infer<typeof keeperSchema>;
