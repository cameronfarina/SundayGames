import type { LeagueSyncProvider } from "../../data/leagueSyncProviderAdapters.js";
import type {
  LeagueSnapshot,
  StoredLeagueSnapshot,
  StoredPlayerDirectory,
} from "../leagueConnections.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { LeagueConnectionSnapshotRow, ProviderPlayerDirectoryRow } from "./contracts.js";
import { playerDirectoryFromRow, snapshotFromRow } from "./mapping.js";
import {
  selectPlayerDirectorySql,
  selectSnapshotSql,
  upsertPlayerDirectorySql,
  upsertSnapshotSql,
} from "./sql.js";

export const saveSnapshotRow = async (
  client: PostgresTransactionalQueryClient,
  connectionId: string,
  snapshot: LeagueSnapshot,
  syncedAt: string,
): Promise<void> => {
  await client.query(upsertSnapshotSql, [
    connectionId,
    JSON.stringify(snapshot.settings),
    JSON.stringify(snapshot.teams),
    JSON.stringify(snapshot.matchups),
    syncedAt,
  ]);
};

export const findSnapshotRow = async (
  client: PostgresTransactionalQueryClient,
  connectionId: string,
): Promise<StoredLeagueSnapshot | null> => {
  const result = await client.query<LeagueConnectionSnapshotRow>(selectSnapshotSql, [connectionId]);
  const row = result.rows[0];
  return row === undefined ? null : snapshotFromRow(row);
};

export const savePlayerDirectoryRow = async (
  client: PostgresTransactionalQueryClient,
  directory: StoredPlayerDirectory,
): Promise<void> => {
  await client.query(upsertPlayerDirectorySql, [
    directory.provider,
    JSON.stringify(directory.entries),
    directory.fetchedAt,
  ]);
};

export const findPlayerDirectoryRow = async (
  client: PostgresTransactionalQueryClient,
  provider: LeagueSyncProvider,
): Promise<StoredPlayerDirectory | null> => {
  const result = await client.query<ProviderPlayerDirectoryRow>(selectPlayerDirectorySql, [provider]);
  const row = result.rows[0];
  return row === undefined ? null : playerDirectoryFromRow(row);
};
