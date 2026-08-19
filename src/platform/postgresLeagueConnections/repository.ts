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
} from "../leagueConnections.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type {
  LeagueConnectionCredentialRow,
  LeagueConnectionRow,
  LeagueConnectionSnapshotRow,
  ProviderPlayerDirectoryRow,
} from "./contracts.js";
import { connectionFromRow, playerDirectoryFromRow, snapshotFromRow } from "./mapping.js";
import {
  deleteConnectionSql,
  linkConnectionSql,
  selectConnectionSql,
  selectConnectionsSql,
  selectCredentialsSql,
  selectPlayerDirectorySql,
  selectSnapshotSql,
  updateConnectionStatusSql,
  upsertConnectionSql,
  upsertPlayerDirectorySql,
  upsertSnapshotSql,
} from "./sql.js";

const trimmedOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
};

export class PostgresLeagueConnectionRepository implements LeagueConnectionRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
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
    const result = await this.#client.query<LeagueConnectionCredentialRow>(
      selectCredentialsSql,
      [id],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      ...(row.espn_s2 === null ? {} : { espnS2: row.espn_s2 }),
      ...(row.swid === null ? {} : { swid: row.swid }),
    };
  }

  async saveConnection(input: SaveLeagueConnectionInput): Promise<LeagueConnection> {
    const result = await this.#client.query<LeagueConnectionRow>(upsertConnectionSql, [
      `league_connection_${randomUUID()}`,
      input.accountId,
      input.provider,
      input.providerLeagueId,
      input.season,
      input.displayName,
      trimmedOrNull(input.credentials?.espnS2),
      trimmedOrNull(input.credentials?.swid),
      (input.now ?? new Date()).toISOString(),
    ]);
    const row = result.rows[0];
    if (row === undefined) throw new Error("Saving a league connection returned no row.");
    return connectionFromRow(row);
  }

  async linkConnection(input: LinkLeagueConnectionInput): Promise<LeagueConnection | null> {
    const result = await this.#client.query<LeagueConnectionRow>(linkConnectionSql, [
      input.id,
      input.accountId,
      input.leagueId,
      input.seasonId,
      (input.now ?? new Date()).toISOString(),
    ]);
    const row = result.rows[0];
    return row === undefined ? null : connectionFromRow(row);
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

  async deleteConnection(accountId: string, id: string): Promise<boolean> {
    const result = await this.#client.query(deleteConnectionSql, [accountId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  async saveSnapshot(
    connectionId: string,
    snapshot: LeagueSnapshot,
    syncedAt: string,
  ): Promise<void> {
    await this.#client.query(upsertSnapshotSql, [
      connectionId,
      JSON.stringify(snapshot.settings),
      JSON.stringify(snapshot.teams),
      JSON.stringify(snapshot.matchups),
      syncedAt,
    ]);
  }

  async findSnapshot(connectionId: string): Promise<StoredLeagueSnapshot | null> {
    const result = await this.#client.query<LeagueConnectionSnapshotRow>(
      selectSnapshotSql,
      [connectionId],
    );
    const row = result.rows[0];
    return row === undefined ? null : snapshotFromRow(row);
  }

  async savePlayerDirectory(directory: StoredPlayerDirectory): Promise<void> {
    await this.#client.query(upsertPlayerDirectorySql, [
      directory.provider,
      JSON.stringify(directory.entries),
      directory.fetchedAt,
    ]);
  }

  async findPlayerDirectory(provider: LeagueSyncProvider): Promise<StoredPlayerDirectory | null> {
    const result = await this.#client.query<ProviderPlayerDirectoryRow>(
      selectPlayerDirectorySql,
      [provider],
    );
    const row = result.rows[0];
    return row === undefined ? null : playerDirectoryFromRow(row);
  }
}
