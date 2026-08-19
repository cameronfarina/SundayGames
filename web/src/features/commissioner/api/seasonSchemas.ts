import { z } from "zod";

const teamSchema = z.object({
  id: z.string(),
  leagueSeasonId: z.string(),
  ownerId: z.string(),
  ownerDisplayName: z.string(),
  managerDisplayNames: z.array(z.string()).optional(),
  abbreviation: z.string().optional(),
  displayName: z.string(),
  draftOrderPosition: z.number(),
});

const scoringSchema = z.object({
  passingYards: z.number(),
  passingTouchdown: z.number(),
  rushingYards: z.number(),
  rushingTouchdown: z.number(),
  receivingYards: z.number(),
  receivingTouchdown: z.number(),
  reception: z.number(),
});

const rosterSchema = z.object({
  rosterSize: z.number(),
  lineup: z.record(z.string(), z.number()),
  lineupSlotCount: z.number(),
  rosterMaximums: z.record(z.string(), z.number()),
});

const settingsCore = {
  expectedTeamCount: z.number(),
  scoring: scoringSchema,
  roster: rosterSchema,
  keeperPolicy: z.object({
    mode: z.literal("previous-cost-multiplier"),
    multiplier: z.number(),
    rounding: z.literal("ceil"),
    enabled: z.boolean().optional(),
  }),
  manualInflationMultiplier: z.number().optional(),
};

const settingsSchema = z.discriminatedUnion("draftFormat", [
  z.object({
    ...settingsCore,
    draftFormat: z.literal("auction"),
    auction: z.object({ budgetDollars: z.number(), minimumBidDollars: z.number() }),
  }),
  z.object({
    ...settingsCore,
    draftFormat: z.literal("snake"),
    snake: z.object({
      rounds: z.number(),
      order: z.array(z.string()),
    }),
  }),
]);

export const seasonSchema = z.object({
  id: z.string(),
  league: z.object({
    id: z.string(),
    externalLeagueId: z.string(),
    name: z.string(),
    provider: z.enum(["mockd", "espn", "sleeper", "yahoo"]),
  }),
  leagueId: z.string(),
  seasonYear: z.number(),
  teams: z.array(teamSchema),
  settings: settingsSchema,
  setupStatus: z.enum(["draft", "published", "locked"]),
  draft: z.object({
    scheduledAt: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
});

export const seasonResponseSchema = z.object({
  season: seasonSchema,
  claimableTeams: z.array(teamSchema),
});

export type CommissionerSeason = z.infer<typeof seasonSchema>;
