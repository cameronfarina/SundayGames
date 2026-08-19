import { z } from "zod";
import type {
  SyncedLeagueSettings,
  SyncedMatchup,
  SyncedTeam,
} from "../../data/leagueSyncProviderAdapters.js";
import type { PlayerDirectoryRow } from "../leagueConnections.js";

const jsonValueFromDb = (value: unknown): unknown =>
  typeof value !== "string" ? value : JSON.parse(value);

const draftSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auction"),
    budgetDollars: z.number(),
    minimumBidDollars: z.number(),
  }),
  z.object({
    type: z.literal("snake"),
    rounds: z.number(),
    order: z.array(z.string()),
  }),
]);

const settingsSchema = z.object({
  name: z.string(),
  season: z.string(),
  teamCount: z.number(),
  rosterPositions: z.array(z.string()),
  scoring: z.record(z.string(), z.number()),
  draft: draftSchema.optional(),
  keeperLeague: z.boolean().optional(),
  status: z.string().optional(),
  playoffTeams: z.number().optional(),
  playoffWeekStart: z.number().optional(),
  waiverBudget: z.number().optional(),
});

const rosterPlayerSchema = z.object({
  providerPlayerId: z.string(),
  name: z.string(),
  position: z.string().optional(),
  teamAbbreviation: z.string().optional(),
  lineupSlot: z.string().optional(),
  injuryStatus: z.string().optional(),
  starter: z.boolean(),
});

const teamSchema = z.object({
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

const matchupSchema = z.object({
  week: z.number(),
  matchupKey: z.string(),
  homeTeamId: z.string(),
  homePoints: z.number(),
  awayTeamId: z.string().optional(),
  awayPoints: z.number().optional(),
});

const directoryEntrySchema = z.object({
  name: z.string(),
  position: z.string().optional(),
  teamAbbreviation: z.string().optional(),
});

const emptySettings: SyncedLeagueSettings = {
  name: "Unknown league",
  season: "",
  teamCount: 0,
  rosterPositions: [],
  scoring: {},
};

export const settingsFromDb = (value: unknown): SyncedLeagueSettings => {
  const parsed = settingsSchema.safeParse(jsonValueFromDb(value));
  return parsed.success ? parsed.data : emptySettings;
};

export const teamsFromDb = (value: unknown): readonly SyncedTeam[] => {
  const parsed = z.array(teamSchema).safeParse(jsonValueFromDb(value));
  return parsed.success ? parsed.data : [];
};

export const matchupsFromDb = (value: unknown): readonly SyncedMatchup[] => {
  const parsed = z.array(matchupSchema).safeParse(jsonValueFromDb(value));
  return parsed.success ? parsed.data : [];
};

export const playerDirectoryFromDb = (
  value: unknown,
): Readonly<Record<string, PlayerDirectoryRow>> => {
  const parsed = z.record(z.string(), z.unknown()).safeParse(jsonValueFromDb(value));
  if (!parsed.success) return {};

  const directory: Record<string, PlayerDirectoryRow> = {};
  for (const [playerId, entry] of Object.entries(parsed.data)) {
    const player = directoryEntrySchema.safeParse(entry);
    if (player.success) directory[playerId] = player.data;
  }
  return directory;
};
