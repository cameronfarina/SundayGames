export type LeagueSyncProvider = "sleeper" | "espn" | "yahoo";

export const leagueSyncProviders: readonly LeagueSyncProvider[] = ["sleeper", "espn", "yahoo"];

export const isLeagueSyncProvider = (value: unknown): value is LeagueSyncProvider =>
  leagueSyncProviders.some(candidate => candidate === value);

/**
 * Every failure the owner can act on gets its own code. The connection status
 * and the message the owner reads are both derived from this, so a new failure
 * mode must be named here rather than collapsed into a generic error.
 */
export type LeagueSyncFailureCode =
  | "credentials_required"
  | "credentials_rejected"
  | "league_not_found"
  | "provider_unavailable"
  | "provider_unreachable"
  | "provider_response_invalid";

export class LeagueSyncError extends Error {
  readonly code: LeagueSyncFailureCode;

  constructor(code: LeagueSyncFailureCode, message: string) {
    super(message);
    this.name = "LeagueSyncError";
    this.code = code;
  }
}

export interface LeagueSyncCredentials {
  espnS2?: string | undefined;
  swid?: string | undefined;
}

export type LeagueSyncFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface LeagueSyncRequestOptions {
  credentials?: LeagueSyncCredentials | undefined;
  fetcher?: LeagueSyncFetch | undefined;
  timeoutMs?: number | undefined;
}

export interface DiscoverLeaguesInput extends LeagueSyncRequestOptions {
  /** A Sleeper username, or an ESPN league id or league URL. */
  handle: string;
  season: string;
}

export interface FetchLeagueInput extends LeagueSyncRequestOptions {
  providerLeagueId: string;
  season: string;
}

export interface DiscoveredLeague {
  providerLeagueId: string;
  name: string;
  season: string;
  teamCount: number;
}

export interface SyncedLeagueSettings {
  name: string;
  season: string;
  teamCount: number;
  rosterPositions: readonly string[];
  scoring: Readonly<Record<string, number>>;
  status?: string | undefined;
  playoffTeams?: number | undefined;
  playoffWeekStart?: number | undefined;
  waiverBudget?: number | undefined;
  /**
   * The draft shape, when the provider publishes it. League import builds a real
   * Sunday Games league out of these, so a provider that hides one leaves it
   * undefined and the owner finishes that part in the wizard instead.
   */
  draftType?: "auction" | "snake" | undefined;
  auctionBudget?: number | undefined;
  minimumBid?: number | undefined;
  snakeRounds?: number | undefined;
  keeperCount?: number | undefined;
}

export interface SyncedRosterPlayer {
  providerPlayerId: string;
  name: string;
  position?: string | undefined;
  teamAbbreviation?: string | undefined;
  lineupSlot?: string | undefined;
  injuryStatus?: string | undefined;
  starter: boolean;
}

export interface SyncedTeam {
  providerTeamId: string;
  name: string;
  ownerNames: readonly string[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  players: readonly SyncedRosterPlayer[];
}

export interface SyncedMatchup {
  week: number;
  matchupKey: string;
  homeTeamId: string;
  homePoints: number;
  awayTeamId?: string | undefined;
  awayPoints?: number | undefined;
}

export interface SyncedLeague {
  provider: LeagueSyncProvider;
  providerLeagueId: string;
  settings: SyncedLeagueSettings;
  teams: readonly SyncedTeam[];
  matchups: readonly SyncedMatchup[];
}

/** A provider player id mapped to the little the roster view needs to render. */
export interface PlayerDirectoryEntry {
  name: string;
  position?: string | undefined;
  teamAbbreviation?: string | undefined;
}

export type PlayerDirectory = Readonly<Record<string, PlayerDirectoryEntry>>;

export interface LeagueSyncAdapter {
  provider: LeagueSyncProvider;
  /** True when the adapter can reach its provider with the configuration it has. */
  isAvailable: () => boolean;
  /** Rosters name players by provider id; only these adapters need a directory. */
  needsPlayerDirectory: boolean;
  fetchPlayerDirectory?: (options: LeagueSyncRequestOptions) => Promise<PlayerDirectory>;
  discoverLeagues: (input: DiscoverLeaguesInput) => Promise<readonly DiscoveredLeague[]>;
  fetchLeague: (input: FetchLeagueInput, directory: PlayerDirectory) => Promise<SyncedLeague>;
}
