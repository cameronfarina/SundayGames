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
} from "../leagueConnections.js";
import type { LeagueConnectionCredentialCipher } from
  "../leagueConnectionCredentialEncryption.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { LeagueConnectionRow } from "./contracts.js";
import { PostgresLeagueConnectionCredentialStore } from "./credentials.js";
import { connectionFromRow } from "./mapping.js";
import {
  findPlayerDirectoryRow,
  findSnapshotRow,
  savePlayerDirectoryRow,
  saveSnapshotRow,
} from "./snapshotQueries.js";
import {
  deleteConnectionSql,
  linkConnectionToSeasonSql,
  selectConnectionSql,
  selectConnectionsSql,
  updateConnectionStatusSql,
  upsertConnectionSql,
} from "./sql.js";

export class PostgresLeagueConnectionRepository implements LeagueConnectionRepository {
  readonly #client: PostgresTransactionalQueryClient;
  readonly #credentials: PostgresLeagueConnectionCredentialStore;

  constructor(
    client: PostgresTransactionalQueryClient,
    credentialCipher?: LeagueConnectionCredentialCipher,
  ) {
    this.#client = client;
    this.#credentials = new PostgresLeagueConnectionCredentialStore(client, credentialCipher);
  }

  async listConnections(accountId: string): Promise<readonly LeagueConnection[]> {
    const result = await this.#client.query<LeagueConnectionRow>(selectConnectionsSql, [accountId]);
    return result.rows.map(connectionFromRow);
  }

  async findConnection(accountId: string, id: string): Promise<LeagueConnection | null> {
    const result = await this.#client.query<LeagueConnectionRow>(
      selectConnectionSql,
      [accountId, id],
    );
    const row = result.rows[0];
    return row === undefined ? null : connectionFromRow(row);
  }

  async findCredentials(id: string): Promise<LeagueConnectionCredentials | null> {
    return await this.#credentials.find(id);
  }

  async saveConnection(input: SaveLeagueConnectionInput): Promise<LeagueConnection> {
    const credentialContext = {
      accountId: input.accountId,
      providerLeagueId: input.providerLeagueId,
      season: input.season,
    };
    const credentials = input.provider === "espn"
      ? this.#credentials.encryptedFor(input.credentials, credentialContext)
      : undefined;
    const result = await this.#client.query<LeagueConnectionRow>(upsertConnectionSql, [
      `league_connection_${randomUUID()}`,
      input.accountId,
      input.provider,
      input.providerLeagueId,
      input.season,
      input.displayName,
      credentials?.ciphertext ?? null,
      credentials?.keyId ?? null,
      (input.now ?? new Date()).toISOString(),
    ]);
    const row = result.rows[0];
    if (row === undefined) throw new Error("Saving a league connection returned no row.");
    return connectionFromRow(row);
  }

  async updateConnectionStatus(input: UpdateLeagueConnectionStatusInput): Promise<void> {
    await this.#client.query(updateConnectionStatusSql, [
      input.id,
      input.status,
      input.statusDetail ?? null,
      input.lastSyncedAt ?? null,
      (input.now ?? new Date()).toISOString(),
    ]);
  }

  async linkConnectionToSeason(id: string, leagueSeasonId: string): Promise<void> {
    await this.#client.query(linkConnectionToSeasonSql, [
      id,
      leagueSeasonId,
      new Date().toISOString(),
    ]);
  }

  async deleteConnection(accountId: string, id: string): Promise<boolean> {
    const result = await this.#client.query(deleteConnectionSql, [accountId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  async saveSnapshot(
    connectionId: string,
    snapshot: LeagueSnapshot,
    syncedAt: string,
  ): Promise<void> {
    await saveSnapshotRow(this.#client, connectionId, snapshot, syncedAt);
  }

  async findSnapshot(connectionId: string): Promise<StoredLeagueSnapshot | null> {
    return await findSnapshotRow(this.#client, connectionId);
  }

  async savePlayerDirectory(directory: StoredPlayerDirectory): Promise<void> {
    await savePlayerDirectoryRow(this.#client, directory);
  }

  async findPlayerDirectory(provider: LeagueSyncProvider): Promise<StoredPlayerDirectory | null> {
    return await findPlayerDirectoryRow(this.#client, provider);
  }
}
