import {
  isLeagueSyncProvider,
  type LeagueSyncProvider,
} from "../../data/leagueSyncProviderAdapters.js";
import type {
  LeagueConnection,
  LeagueConnectionStatus,
  StoredLeagueSnapshot,
  StoredPlayerDirectory,
} from "../leagueConnections.js";
import type {
  LeagueConnectionRow,
  LeagueConnectionSnapshotRow,
  ProviderPlayerDirectoryRow,
} from "./contracts.js";
import {
  matchupsFromDb,
  playerDirectoryFromDb,
  settingsFromDb,
  teamsFromDb,
} from "./snapshotCodec.js";

const isoStringFrom = (value: Date | string): string =>
  typeof value === "string" ? value : value.toISOString();

const connectionStatuses: readonly LeagueConnectionStatus[] = [
  "pending",
  "ok",
  "needs_attention",
  "error",
];

const statusFrom = (value: string): LeagueConnectionStatus =>
  connectionStatuses.find(candidate => candidate === value) ?? "error";

const providerFrom = (value: string): LeagueSyncProvider =>
  isLeagueSyncProvider(value) ? value : "sleeper";

export const connectionFromRow = (row: LeagueConnectionRow): LeagueConnection => ({
  id: row.id,
  accountId: row.account_id,
  provider: providerFrom(row.provider),
  providerLeagueId: row.provider_league_id,
  season: row.season,
  displayName: row.display_name,
  status: statusFrom(row.status),
  ...(row.status_detail === null ? {} : { statusDetail: row.status_detail }),
  ...(row.last_synced_at === null ? {} : { lastSyncedAt: isoStringFrom(row.last_synced_at) }),
  ...(row.linked_league_id === null ? {} : { linkedLeagueId: row.linked_league_id }),
  ...(row.linked_season_id === null ? {} : { linkedSeasonId: row.linked_season_id }),
  createdAt: isoStringFrom(row.created_at),
  updatedAt: isoStringFrom(row.updated_at),
});

export const snapshotFromRow = (row: LeagueConnectionSnapshotRow): StoredLeagueSnapshot => ({
  connectionId: row.connection_id,
  settings: settingsFromDb(row.settings_json),
  teams: teamsFromDb(row.teams_json),
  matchups: matchupsFromDb(row.matchups_json),
  syncedAt: isoStringFrom(row.synced_at),
});

export const playerDirectoryFromRow = (
  row: ProviderPlayerDirectoryRow,
): StoredPlayerDirectory => ({
  provider: providerFrom(row.provider),
  entries: playerDirectoryFromDb(row.entries_json),
  fetchedAt: isoStringFrom(row.fetched_at),
});
