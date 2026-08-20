import {
  isLeagueSyncProvider,
  leagueSyncAdapters,
  type LeagueSyncCredentials,
  type LeagueSyncProvider,
} from "../../../../data/leagueSyncProviderAdapters.js";
import type { LeagueConnection } from "../../../leagueConnections.js";
import type {
  ImportedSeasonRefresher,
  LeagueSyncServiceOptions,
} from "../../../leagueSyncService.js";
import { convergeImportedSeason } from "../../../leagueSyncService/importedSeasonConvergence.js";
import type { PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import { knownError } from "../../responses.js";
import type { ImportedLeague } from "./importedLeague.js";

const refreshCurrentImportedSeason = async (
  repository: NonNullable<PlatformHttpServices["leagueConnectionRepository"]>,
  refresh: ImportedSeasonRefresher,
  input: Parameters<ImportedSeasonRefresher>[0],
): Promise<string | null> => {
  const converged = await convergeImportedSeason(repository, input.connection, refresh);
  return converged.detail;
};

export const leagueConnectionsUnavailable = (): PlatformHttpResponse => knownError(
  503,
  "league_connections_unavailable",
  "Connected leagues are not available on this server.",
);

export const serviceOptionsFor = (
  services: PlatformHttpServices,
  refreshImportedSeason?: ImportedSeasonRefresher | undefined,
): LeagueSyncServiceOptions | null => {
  const repository = services.leagueConnectionRepository;
  if (repository === undefined) return null;
  const runSeasonRefresh = services.runLeagueSyncSeasonRefresh;
  const guardedRefresh = refreshImportedSeason === undefined || runSeasonRefresh === undefined
    ? refreshImportedSeason
    : async (input: Parameters<ImportedSeasonRefresher>[0]) =>
        await runSeasonRefresh(async () =>
          await refreshCurrentImportedSeason(repository, refreshImportedSeason, input)
        );
  return {
    adapters: leagueSyncAdapters,
    ...(services.leagueSyncFetch === undefined ? {} : { fetcher: services.leagueSyncFetch }),
    ...(guardedRefresh === undefined ? {} : { refreshImportedSeason: guardedRefresh }),
    repository,
  };
};

export const providerFor = (value: unknown): LeagueSyncProvider | null => {
  const provider = optionalString(value);
  return provider !== undefined && isLeagueSyncProvider(provider) ? provider : null;
};

export const connectionNotFound = (): PlatformHttpResponse => knownError(
  404,
  "connection_not_found",
  "That connected league is no longer here.",
);

export const invalidProvider = (): PlatformHttpResponse => knownError(
  400,
  "unknown_provider",
  "Choose Sleeper, ESPN, or Yahoo.",
);

/** The season the owner is connecting; leagues are listed one season at a time. */
export const seasonFor = (request: ParsedPlatformHttpRequest, value: unknown): string => {
  const season = optionalString(value);
  if (season !== undefined && /^\d{4}$/u.test(season)) return season;
  return String((request.now ?? new Date()).getUTCFullYear());
};

export const credentialsFor = (body: Record<string, unknown>): LeagueSyncCredentials | undefined => {
  const espnS2 = optionalString(body.espnS2);
  const swid = optionalString(body.swid);
  if (espnS2 === undefined && swid === undefined) return undefined;
  return {
    ...(espnS2 === undefined ? {} : { espnS2 }),
    ...(swid === undefined ? {} : { swid }),
  };
};

/** Saved ESPN cookies are write-only: they never travel back to the browser. */
export const publicConnection = (
  connection: LeagueConnection,
  imported?: ImportedLeague | undefined,
) => ({
  id: connection.id,
  provider: connection.provider,
  providerLeagueId: connection.providerLeagueId,
  season: connection.season,
  displayName: connection.displayName,
  status: connection.status,
  ...(connection.statusDetail === undefined ? {} : { statusDetail: connection.statusDetail }),
  ...(connection.lastSyncedAt === undefined ? {} : { lastSyncedAt: connection.lastSyncedAt }),
  createdAt: connection.createdAt,
  ...(imported === undefined ? {} : {
    importedSeasonId: imported.seasonId,
    importedLeagueSlug: imported.leagueSlug,
    importedLeagueName: imported.leagueName,
  }),
});
