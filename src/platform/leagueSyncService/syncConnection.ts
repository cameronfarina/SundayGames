import type {
  LeagueSyncAdapter,
  LeagueSyncFetch,
  LeagueSyncProvider,
} from "../../data/leagueSyncProviderAdapters.js";
import type {
  LeagueConnection,
  LeagueConnectionRepository,
  StoredLeagueSnapshot,
} from "../leagueConnections.js";
import { failureFor, type LeagueSyncFailure } from "./failureStatus.js";
import { playerDirectoryFor } from "./playerDirectory.js";

export interface LeagueSyncServiceOptions {
  adapters: Readonly<Record<LeagueSyncProvider, LeagueSyncAdapter>>;
  fetcher?: LeagueSyncFetch | undefined;
  repository: LeagueConnectionRepository;
}

export interface SyncConnectionResult {
  connection: LeagueConnection;
  failure?: LeagueSyncFailure | undefined;
  snapshot?: StoredLeagueSnapshot | undefined;
}

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
    await options.repository.saveSnapshot(connection.id, {
      settings: league.settings,
      teams: league.teams,
      matchups: league.matchups,
    }, syncedAt);
    await options.repository.updateConnectionStatus({
      id: connection.id,
      status: "ok",
      lastSyncedAt: syncedAt,
      now,
    });

    return {
      connection: {
        ...connection,
        displayName: league.settings.name,
        lastSyncedAt: syncedAt,
        status: "ok",
        statusDetail: undefined,
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
