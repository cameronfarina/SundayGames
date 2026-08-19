import { randomUUID } from "node:crypto";
import type { LeagueSyncProvider } from "../../data/leagueSyncProviderAdapters.js";
import type {
  LeagueConnection,
  LeagueConnectionCredentials,
  LeagueConnectionRepository,
  LeagueSnapshot,
  LinkLeagueConnectionInput,
  SaveLeagueConnectionInput,
  StoredLeagueSnapshot,
  StoredPlayerDirectory,
  UpdateLeagueConnectionStatusInput,
} from "./contracts.js";

const clone = <T>(value: T): T => structuredClone(value);

const connectionKey = (input: SaveLeagueConnectionInput): string =>
  [input.accountId, input.provider, input.providerLeagueId, input.season].join("\0");

export class InMemoryLeagueConnectionRepository implements LeagueConnectionRepository {
  readonly #connectionsById = new Map<string, LeagueConnection>();
  readonly #credentialsById = new Map<string, LeagueConnectionCredentials>();
  readonly #snapshotsByConnectionId = new Map<string, StoredLeagueSnapshot>();
  readonly #directoriesByProvider = new Map<LeagueSyncProvider, StoredPlayerDirectory>();

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
      ...(existing?.linkedLeagueId === undefined ? {} : { linkedLeagueId: existing.linkedLeagueId }),
      ...(existing?.linkedSeasonId === undefined ? {} : { linkedSeasonId: existing.linkedSeasonId }),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.#connectionsById.set(connection.id, connection);
    if (input.credentials !== undefined) {
      this.#credentialsById.set(connection.id, clone(input.credentials));
    }
    return clone(connection);
  }

  async linkConnection(input: LinkLeagueConnectionInput): Promise<LeagueConnection | null> {
    const existing = this.#connectionsById.get(input.id);
    if (existing === undefined || existing.accountId !== input.accountId) return null;
    const linked = {
      ...existing,
      linkedLeagueId: input.leagueId,
      linkedSeasonId: input.seasonId,
      updatedAt: (input.now ?? new Date()).toISOString(),
    };
    this.#connectionsById.set(input.id, linked);
    return clone(linked);
  }

  async updateConnectionStatus(input: UpdateLeagueConnectionStatusInput): Promise<void> {
    const existing = this.#connectionsById.get(input.id);
    if (existing === undefined) return;
    this.#connectionsById.set(input.id, {
      ...existing,
      status: input.status,
      ...(input.statusDetail === undefined ? {} : { statusDetail: input.statusDetail }),
      ...(input.lastSyncedAt === undefined ? {} : { lastSyncedAt: input.lastSyncedAt }),
      updatedAt: (input.now ?? new Date()).toISOString(),
    });
  }

  async deleteConnection(accountId: string, id: string): Promise<boolean> {
    const connection = this.#connectionsById.get(id);
    if (connection === undefined || connection.accountId !== accountId) return false;
    this.#connectionsById.delete(id);
    this.#credentialsById.delete(id);
    this.#snapshotsByConnectionId.delete(id);
    return true;
  }

  async saveSnapshot(
    connectionId: string,
    snapshot: LeagueSnapshot,
    syncedAt: string,
  ): Promise<void> {
    this.#snapshotsByConnectionId.set(connectionId, clone({ ...snapshot, connectionId, syncedAt }));
  }

  async findSnapshot(connectionId: string): Promise<StoredLeagueSnapshot | null> {
    const snapshot = this.#snapshotsByConnectionId.get(connectionId);
    return snapshot === undefined ? null : clone(snapshot);
  }

  async savePlayerDirectory(directory: StoredPlayerDirectory): Promise<void> {
    this.#directoriesByProvider.set(directory.provider, clone(directory));
  }

  async findPlayerDirectory(provider: LeagueSyncProvider): Promise<StoredPlayerDirectory | null> {
    const directory = this.#directoriesByProvider.get(provider);
    return directory === undefined ? null : clone(directory);
  }
}
