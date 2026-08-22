import { z } from "zod";

const countSchema = z.number().int().nonnegative();
const readinessSchema = z.enum(["ready", "needs_attention"]);

export const accountDashboardLeagueSchema = z.object({
  draft: z.object({
    roomId: z.string().optional(),
    startsAt: z.string().optional(),
    status: z.string().optional(),
    timezone: z.string().optional(),
  }),
  draftFormat: z.enum(["auction", "snake"]),
  leagueId: z.string(),
  leagueName: z.string(),
  leagueSlug: z.string(),
  membershipRole: z.enum(["owner", "admin", "member", "observer"]),
  metrics: z.object({
    completedMocks: countSchema,
    historicalImportSeasons: countSchema,
    savedSimulationOutcomes: countSchema,
    simulationRuns: countSchema,
    simulationsCompleted: countSchema,
  }),
  provider: z.enum(["mockd", "espn", "sleeper", "yahoo"]),
  readiness: z.object({
    leagueSetup: readinessSchema,
    liveDraft: readinessSchema,
    teamClaim: readinessSchema,
  }),
  seasonId: z.string(),
  seasonStatus: z.enum(["draft", "published", "locked"]),
  seasonYear: z.number().int(),
  teamCount: countSchema,
  teamDisplayName: z.string().optional(),
});

export const accountDashboardSchema = z.object({
  leagues: z.array(accountDashboardLeagueSchema),
});

export type AccountDashboard = z.output<typeof accountDashboardSchema>;
export type AccountDashboardLeague = z.output<typeof accountDashboardLeagueSchema>;
