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
import { admitLeagueConnectionSync } from "./connectionAdmission.js";
import { authoritativeSyncResult } from "./authoritativeResult.js";
import { failureFor, type LeagueSyncFailure } from "./failureStatus.js";
import { playerDirectoryFor } from "./playerDirectory.js";
import {
  refreshImportedSeasonDetail,
  type ImportedSeasonRefresher,
} from "./refreshImportedSeason.js";

export type { ImportedSeasonRefresher } from "./refreshImportedSeason.js";

export interface LeagueSyncServiceOptions {
  adapters: Readonly<Record<LeagueSyncProvider, LeagueSyncAdapter>>;
  fetcher?: LeagueSyncFetch | undefined;
  repository: LeagueConnectionRepository;
  refreshImportedSeason?: ImportedSeasonRefresher | undefined;
}

export interface SyncConnectionResult {
  connection: LeagueConnection | null;
  failure?: LeagueSyncFailure | undefined;
  snapshot?: StoredLeagueSnapshot | undefined;
}

const executeLeagueConnectionSync = async (
  options: LeagueSyncServiceOptions,
  connection: LeagueConnection,
  now: Date,
): Promise<SyncConnectionResult> => {
  const syncRevision = await options.repository.beginConnectionSync(connection.id);
  if (syncRevision === null) return await authoritativeSyncResult(options.repository, connection);
  const adapter = options.adapters[connection.provider];

  try {
    const credentials = connection.provider === "espn"
      ? await options.repository.findCredentials(connection.id) ?? undefined
      : undefined;
    const requestOptions = {
      ...(credentials === undefined ? {} : { credentials }),
      ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
    };
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
    const saved = await options.repository.saveSnapshot(
      connection.id,
      snapshot,
      syncedAt,
      syncRevision,
    );
    if (!saved) {
      return await authoritativeSyncResult(options.repository, connection);
    }
    const refreshDetail = await refreshImportedSeasonDetail(
      options.refreshImportedSeason,
      connection,
      snapshot,
      syncedAt,
      syncRevision,
    );
    const statusSaved = await options.repository.updateConnectionStatus({
      id: connection.id,
      displayName: league.settings.name,
      status: refreshDetail === null ? "ok" : "needs_attention",
      ...(refreshDetail === null ? {} : { statusDetail: refreshDetail }),
      lastSyncedAt: syncedAt,
      expectedSyncRevision: syncRevision,
      now,
    });
    if (!statusSaved) {
      return await authoritativeSyncResult(options.repository, connection);
    }

    return {
      connection: {
        ...connection,
        displayName: league.settings.name,
        lastSyncedAt: syncedAt,
        status: refreshDetail === null ? "ok" : "needs_attention",
        statusDetail: refreshDetail ?? undefined,
      },
      snapshot: {
        ...snapshot,
        connectionId: connection.id,
        syncedAt,
        syncRevision,
      },
    };
  } catch (error) {
    const failure = failureFor(error);
    const statusSaved = await options.repository.updateConnectionStatus({
      id: connection.id,
      status: failure.status,
      statusDetail: failure.message,
      expectedSyncRevision: syncRevision,
      now,
    });
    if (!statusSaved) {
      return await authoritativeSyncResult(options.repository, connection);
    }
    return {
      connection: { ...connection, status: failure.status, statusDetail: failure.message },
      failure,
    };
  }
};

export const syncLeagueConnection = async (
  options: LeagueSyncServiceOptions,
  connection: LeagueConnection,
  now: Date,
): Promise<SyncConnectionResult> => await admitLeagueConnectionSync(
  options.repository,
  connection.id,
  async () => await executeLeagueConnectionSync(options, connection, now),
);
