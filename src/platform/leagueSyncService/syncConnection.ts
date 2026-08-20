import type {
  LeagueSyncAdapter,
  LeagueSyncFetch,
  LeagueSyncProvider,
} from "../../data/leagueSyncProviderAdapters.js";
import type {
  LeagueConnection,
  LeagueConnectionRepository,
  LeagueSnapshot,
  StoredLeagueSnapshot,
} from "../leagueConnections.js";
import { failureFor, type LeagueSyncFailure } from "./failureStatus.js";
import { playerDirectoryFor } from "./playerDirectory.js";

/**
 * Refreshes the Sunday Games league a connection was imported into. It answers
 * with the one thing the owner has to read, or null when the refresh needed no
 * explanation. The sync service holds no app, so the HTTP layer supplies this.
 */
export type ImportedSeasonRefresher = (input: {
  connection: LeagueConnection;
  snapshot: LeagueSnapshot;
}) => Promise<string | null>;

export interface LeagueSyncServiceOptions {
  adapters: Readonly<Record<LeagueSyncProvider, LeagueSyncAdapter>>;
  fetcher?: LeagueSyncFetch | undefined;
  repository: LeagueConnectionRepository;
  refreshImportedSeason?: ImportedSeasonRefresher | undefined;
}

export interface SyncConnectionResult {
  connection: LeagueConnection;
  failure?: LeagueSyncFailure | undefined;
  snapshot?: StoredLeagueSnapshot | undefined;
}

/**
 * A snapshot is worth saving even when the league it feeds cannot take it, so
 * a refresh that fails hands back its reason instead of losing the sync.
 */
const refreshDetailFor = async (
  options: LeagueSyncServiceOptions,
  connection: LeagueConnection,
  snapshot: LeagueSnapshot,
): Promise<string | null> => {
  const refresh = options.refreshImportedSeason;
  if (refresh === undefined || connection.leagueSeasonId === undefined) return null;
  try {
    return await refresh({ connection, snapshot });
  } catch {
    return "This league synced, but the Sunday Games league it created could not be updated.";
  }
};

export const syncLeagueConnection = async (
  options: LeagueSyncServiceOptions,
  connection: LeagueConnection,
  now: Date,
): Promise<SyncConnectionResult> => {
  const adapter = options.adapters[connection.provider];
  const credentials = await options.repository.findCredentials(connection.id) ?? undefined;
  const requestOptions = {
    ...(credentials === undefined ? {} : { credentials }),
    ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
  };

  try {
    const directory = await playerDirectoryFor(adapter, options.repository, requestOptions, now);
    const league = await adapter.fetchLeague({
      ...requestOptions,
      providerLeagueId: connection.providerLeagueId,
      season: connection.season,
    }, directory);
    const syncedAt = now.toISOString();
    const snapshot: LeagueSnapshot = {
      settings: league.settings,
      teams: league.teams,
      matchups: league.matchups,
    };
    await options.repository.saveSnapshot(connection.id, snapshot, syncedAt);
    const refreshDetail = await refreshDetailFor(options, connection, snapshot);
    await options.repository.updateConnectionStatus({
      id: connection.id,
      status: refreshDetail === null ? "ok" : "needs_attention",
      ...(refreshDetail === null ? {} : { statusDetail: refreshDetail }),
      lastSyncedAt: syncedAt,
      now,
    });

    return {
      connection: {
        ...connection,
        displayName: league.settings.name,
        lastSyncedAt: syncedAt,
        status: refreshDetail === null ? "ok" : "needs_attention",
        statusDetail: refreshDetail ?? undefined,
      },
      snapshot: {
        connectionId: connection.id,
        settings: league.settings,
        teams: league.teams,
        matchups: league.matchups,
        syncedAt,
      },
    };
  } catch (error) {
    const failure = failureFor(error);
    await options.repository.updateConnectionStatus({
      id: connection.id,
      status: failure.status,
      statusDetail: failure.message,
      now,
    });
    return {
      connection: { ...connection, status: failure.status, statusDetail: failure.message },
      failure,
    };
  }
};
