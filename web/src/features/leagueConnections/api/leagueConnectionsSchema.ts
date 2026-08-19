import { z } from "zod";

export const leagueConnectionProviderSchema = z.enum(["sleeper", "espn", "yahoo"]);

export const leagueConnectionStatusSchema = z.enum([
  "pending",
  "ok",
  "needs_attention",
  "error",
]);

export const leagueConnectionSchema = z.object({
  id: z.string(),
  provider: leagueConnectionProviderSchema,
  providerLeagueId: z.string(),
  season: z.string(),
  displayName: z.string(),
  status: leagueConnectionStatusSchema,
  statusDetail: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  linkedLeagueId: z.string().optional(),
  linkedSeasonId: z.string().optional(),
  createdAt: z.string(),
});

export const leagueConnectionProviderInfoSchema = z.object({
  provider: leagueConnectionProviderSchema,
  label: z.string(),
  availability: z.enum(["connectable", "unavailable"]),
  handleKind: z.enum(["sleeper-username", "espn-league-id", "none"]),
  handleLabel: z.string(),
  handleHint: z.string(),
  detail: z.string(),
  supportsCookieCredentials: z.boolean(),
  handleNamesOneLeague: z.boolean(),
});

export const leagueConnectionListSchema = z.object({
  connections: z.array(leagueConnectionSchema),
  providers: z.array(leagueConnectionProviderInfoSchema),
});

export const discoveredLeagueSchema = z.object({
  providerLeagueId: z.string(),
  name: z.string(),
  season: z.string(),
  teamCount: z.number(),
});

export const discoveredLeaguesSchema = z.object({
  leagues: z.array(discoveredLeagueSchema),
  provider: leagueConnectionProviderSchema,
  season: z.string(),
});

export const connectionMutationSchema = z.object({ connection: leagueConnectionSchema });

export const connectionRemovalSchema = z.object({ removed: z.boolean() });

const rosterPlayerSchema = z.object({
  providerPlayerId: z.string(),
  name: z.string(),
  position: z.string().optional(),
  teamAbbreviation: z.string().optional(),
  lineupSlot: z.string().optional(),
  injuryStatus: z.string().optional(),
  starter: z.boolean(),
});

const syncedTeamSchema = z.object({
  providerTeamId: z.string(),
  name: z.string(),
  ownerNames: z.array(z.string()),
  wins: z.number(),
  losses: z.number(),
  ties: z.number(),
  pointsFor: z.number(),
  pointsAgainst: z.number(),
  players: z.array(rosterPlayerSchema),
});

const syncedMatchupSchema = z.object({
  week: z.number(),
  matchupKey: z.string(),
  homeTeamId: z.string(),
  homePoints: z.number(),
  awayTeamId: z.string().optional(),
  awayPoints: z.number().optional(),
});

export const syncedLeagueSchema = z.object({
  settings: z.object({
    name: z.string(),
    season: z.string(),
    teamCount: z.number(),
    rosterPositions: z.array(z.string()),
    scoring: z.record(z.string(), z.number()),
    status: z.string().optional(),
    playoffTeams: z.number().optional(),
    playoffWeekStart: z.number().optional(),
    waiverBudget: z.number().optional(),
  }),
  teams: z.array(syncedTeamSchema),
  matchups: z.array(syncedMatchupSchema),
  syncedAt: z.string(),
});

export const leagueConnectionDetailSchema = z.object({
  connection: leagueConnectionSchema,
  league: syncedLeagueSchema.nullable(),
});

export type LeagueConnection = z.output<typeof leagueConnectionSchema>;
export type LeagueConnectionDetail = z.output<typeof leagueConnectionDetailSchema>;
export type LeagueConnectionProvider = z.output<typeof leagueConnectionProviderSchema>;
export type LeagueConnectionProviderInfo = z.output<typeof leagueConnectionProviderInfoSchema>;
export type LeagueConnectionStatus = z.output<typeof leagueConnectionStatusSchema>;
export type DiscoveredLeague = z.output<typeof discoveredLeagueSchema>;
export type SyncedLeague = z.output<typeof syncedLeagueSchema>;
export type SyncedTeam = z.output<typeof syncedTeamSchema>;
export type SyncedMatchup = z.output<typeof syncedMatchupSchema>;
