import { randomUUID } from "node:crypto";
import type { LeagueSyncProvider } from "../../data/leagueSyncProviderAdapters.js";
import type {
  LeagueConnection,
  LeagueConnectionCredentials,
  LeagueConnectionRepository,
  LeagueSnapshot,
  SaveLeagueConnectionInput,
  StoredLeagueSnapshot,
  StoredPlayerDirectory,
  UpdateLeagueConnectionStatusInput,
} from "./contracts.js";
import { InMemoryLeagueConnectionSyncRevisions } from "./inMemorySyncRevisions.js";
import { syncRevisionIsAfter } from "./syncRevision.js";

const clone = <T>(value: T): T => structuredClone(value);

const connectionKey = (input: SaveLeagueConnectionInput): string =>
  [input.accountId, input.provider, input.providerLeagueId, input.season].join("\0");

export class InMemoryLeagueConnectionRepository implements LeagueConnectionRepository {
  readonly #connectionsById = new Map<string, LeagueConnection>();
  readonly #credentialsById = new Map<string, LeagueConnectionCredentials>();
  readonly #snapshotsByConnectionId = new Map<string, StoredLeagueSnapshot>();
  readonly #directoriesByProvider = new Map<LeagueSyncProvider, StoredPlayerDirectory>();
  readonly #syncRevisions = new InMemoryLeagueConnectionSyncRevisions();

  async listConnections(accountId: string): Promise<readonly LeagueConnection[]> {
    return [...this.#connectionsById.values()]
      .filter(connection => connection.accountId === accountId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id))
      .map(clone);
  }

  async findConnection(accountId: string, id: string): Promise<LeagueConnection | null> {
    const connection = this.#connectionsById.get(id);
    return connection === undefined || connection.accountId !== accountId
      ? null
      : clone(connection);
  }

  async findCredentials(id: string): Promise<LeagueConnectionCredentials | null> {
    const credentials = this.#credentialsById.get(id);
    return credentials === undefined ? null : clone(credentials);
  }

  async saveConnection(input: SaveLeagueConnectionInput): Promise<LeagueConnection> {
    const key = connectionKey(input);
    const existing = [...this.#connectionsById.values()]
      .find(candidate => connectionKey(candidate) === key);
    const timestamp = (input.now ?? new Date()).toISOString();
    if (existing !== undefined && existing.updatedAt > timestamp) return clone(existing);
    const connection: LeagueConnection = {
      id: existing?.id ?? `league_connection_${randomUUID()}`,
      accountId: input.accountId,
      provider: input.provider,
      providerLeagueId: input.providerLeagueId,
      season: input.season,
      displayName: input.displayName,
      status: existing?.status ?? "pending",
      ...(existing?.statusDetail === undefined ? {} : { statusDetail: existing.statusDetail }),
      ...(existing?.lastSyncedAt === undefined ? {} : { lastSyncedAt: existing.lastSyncedAt }),
      ...(existing?.leagueSeasonId === undefined ? {} : { leagueSeasonId: existing.leagueSeasonId }),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.#connectionsById.set(connection.id, connection);
    this.#syncRevisions.recordSavedConnection(connection.id);
    if (input.credentialUpdate?.mode === "clear") this.#credentialsById.delete(connection.id);
    if (input.credentialUpdate?.mode === "replace") {
      this.#credentialsById.set(connection.id, clone(input.credentialUpdate.credentials));
    }
    return clone(connection);
  }

  async beginConnectionSync(id: string): Promise<string | null> {
    return this.#syncRevisions.begin(id);
  }

  async updateConnectionStatus(input: UpdateLeagueConnectionStatusInput): Promise<boolean> {
    const existing = this.#connectionsById.get(input.id);
    if (existing === undefined) return false;
    if (
      input.expectedSyncRevision !== undefined
      && !this.#syncRevisions.matches(input.id, input.expectedSyncRevision)
    ) return false;
    const updatedAt = (input.now ?? new Date()).toISOString();
    if (input.expectedSyncRevision === undefined && existing.updatedAt > updatedAt) return false;
    this.#connectionsById.set(input.id, {
      ...existing,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      status: input.status,
      ...(input.statusDetail === undefined ? {} : { statusDetail: input.statusDetail }),
      ...(input.lastSyncedAt === undefined ? {} : { lastSyncedAt: input.lastSyncedAt }),
      updatedAt: existing.updatedAt > updatedAt ? existing.updatedAt : updatedAt,
    });
    return true;
  }

  async linkConnectionToSeason(id: string, leagueSeasonId: string): Promise<void> {
    const existing = this.#connectionsById.get(id);
    if (existing === undefined) return;
    this.#connectionsById.set(id, { ...existing, leagueSeasonId });
    this.#syncRevisions.advance(id);
  }

  async deleteConnection(accountId: string, id: string): Promise<boolean> {
    const connection = this.#connectionsById.get(id);
    if (connection === undefined || connection.accountId !== accountId) return false;
    this.#connectionsById.delete(id);
    this.#credentialsById.delete(id);
    this.#snapshotsByConnectionId.delete(id);
    this.#syncRevisions.delete(id);
    return true;
  }

  async saveSnapshot(
    connectionId: string,
    snapshot: LeagueSnapshot,
    syncedAt: string,
    syncRevision: string,
  ): Promise<boolean> {
    if (!this.#syncRevisions.matches(connectionId, syncRevision)) return false;
    const existing = this.#snapshotsByConnectionId.get(connectionId);
    if (existing !== undefined && syncRevisionIsAfter(existing.syncRevision, syncRevision)) return false;
    if (existing?.syncRevision === syncRevision && existing.syncedAt > syncedAt) return false;
    this.#snapshotsByConnectionId.set(
      connectionId,
      clone({ ...snapshot, connectionId, syncedAt, syncRevision }),
    );
    return true;
  }

  async findSnapshot(connectionId: string): Promise<StoredLeagueSnapshot | null> {
    const snapshot = this.#snapshotsByConnectionId.get(connectionId);
    return snapshot === undefined ? null : clone(snapshot);
  }

  async savePlayerDirectory(directory: StoredPlayerDirectory): Promise<void> {
    const existing = this.#directoriesByProvider.get(directory.provider);
    if (existing !== undefined && existing.fetchedAt >= directory.fetchedAt) return;
    this.#directoriesByProvider.set(directory.provider, clone(directory));
  }

  async findPlayerDirectory(provider: LeagueSyncProvider): Promise<StoredPlayerDirectory | null> {
    const directory = this.#directoriesByProvider.get(provider);
    return directory === undefined ? null : clone(directory);
  }
}
