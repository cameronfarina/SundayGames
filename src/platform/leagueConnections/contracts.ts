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
  /** The Sunday Games season this connection was imported into, once it has. */
  leagueSeasonId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueConnectionCredentials {
  espnS2?: string | undefined;
  swid?: string | undefined;
}

export type LeagueConnectionCredentialUpdate =
  | { readonly mode: "clear" }
  | {
    readonly credentials: LeagueConnectionCredentials;
    readonly mode: "replace";
  };

export interface SaveLeagueConnectionInput {
  accountId: string;
  provider: LeagueSyncProvider;
  providerLeagueId: string;
  season: string;
  displayName: string;
  credentialUpdate?: LeagueConnectionCredentialUpdate | undefined;
  now?: Date | undefined;
}

export interface UpdateLeagueConnectionStatusInput {
  id: string;
  displayName?: string | undefined;
  status: LeagueConnectionStatus;
  statusDetail?: string | undefined;
  lastSyncedAt?: string | undefined;
  expectedSyncRevision?: string | undefined;
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
  syncRevision: string;
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
  beginConnectionSync(id: string): Promise<string | null>;
  updateConnectionStatus(input: UpdateLeagueConnectionStatusInput): Promise<boolean>;
  linkConnectionToSeason(id: string, leagueSeasonId: string): Promise<void>;
  deleteConnection(accountId: string, id: string): Promise<boolean>;
  saveSnapshot(
    connectionId: string,
    snapshot: LeagueSnapshot,
    syncedAt: string,
    syncRevision: string,
  ): Promise<boolean>;
  findSnapshot(connectionId: string): Promise<StoredLeagueSnapshot | null>;
  savePlayerDirectory(directory: StoredPlayerDirectory): Promise<void>;
  findPlayerDirectory(provider: LeagueSyncProvider): Promise<StoredPlayerDirectory | null>;
}
