import type {
  LeagueSyncProvider,
  SyncedLeagueSettings,
  SyncedMatchup,
  SyncedTeam,
} from "../../data/leagueSyncProviderAdapters.js";

/**
 * What the owner sees next to a connection. "needs_attention" is the state that
 * asks for something only they can supply; "error" is the provider's problem.
 */
export type LeagueConnectionStatus = "pending" | "ok" | "needs_attention" | "error";

export interface LeagueConnection {
  id: string;
  accountId: string;
  provider: LeagueSyncProvider;
  providerLeagueId: string;
  season: string;
  displayName: string;
  status: LeagueConnectionStatus;
  statusDetail?: string | undefined;
  lastSyncedAt?: string | undefined;
  linkedLeagueId?: string | undefined;
  linkedSeasonId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueConnectionCredentials {
  espnS2?: string | undefined;
  swid?: string | undefined;
}

export interface SaveLeagueConnectionInput {
  accountId: string;
  provider: LeagueSyncProvider;
  providerLeagueId: string;
  season: string;
  displayName: string;
  credentials?: LeagueConnectionCredentials | undefined;
  now?: Date | undefined;
}

export interface UpdateLeagueConnectionStatusInput {
  id: string;
  status: LeagueConnectionStatus;
  statusDetail?: string | undefined;
  lastSyncedAt?: string | undefined;
  now?: Date | undefined;
}

export interface LinkLeagueConnectionInput {
  id: string;
  accountId: string;
  leagueId: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface LeagueSnapshot {
  settings: SyncedLeagueSettings;
  teams: readonly SyncedTeam[];
  matchups: readonly SyncedMatchup[];
}

export interface StoredLeagueSnapshot extends LeagueSnapshot {
  connectionId: string;
  syncedAt: string;
}

export interface StoredPlayerDirectory {
  provider: LeagueSyncProvider;
  entries: Readonly<Record<string, PlayerDirectoryRow>>;
  fetchedAt: string;
}

export interface PlayerDirectoryRow {
  name: string;
  position?: string | undefined;
  teamAbbreviation?: string | undefined;
}

export interface LeagueConnectionRepository {
  listConnections(accountId: string): Promise<readonly LeagueConnection[]>;
  findConnection(accountId: string, id: string): Promise<LeagueConnection | null>;
  findCredentials(id: string): Promise<LeagueConnectionCredentials | null>;
  saveConnection(input: SaveLeagueConnectionInput): Promise<LeagueConnection>;
  linkConnection(input: LinkLeagueConnectionInput): Promise<LeagueConnection | null>;
  updateConnectionStatus(input: UpdateLeagueConnectionStatusInput): Promise<void>;
  deleteConnection(accountId: string, id: string): Promise<boolean>;
  saveSnapshot(connectionId: string, snapshot: LeagueSnapshot, syncedAt: string): Promise<void>;
  findSnapshot(connectionId: string): Promise<StoredLeagueSnapshot | null>;
  savePlayerDirectory(directory: StoredPlayerDirectory): Promise<void>;
  findPlayerDirectory(provider: LeagueSyncProvider): Promise<StoredPlayerDirectory | null>;
}
