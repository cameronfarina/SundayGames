import { syncLeagueConnection } from "../../../leagueSyncService.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { methodNotAllowed } from "../../responses.js";
import {
  connectionNotFound,
  leagueConnectionsUnavailable,
  publicConnection,
  serviceOptionsFor,
} from "./context.js";
import { importedLeagueFor } from "./importedLeague.js";
import { importedSeasonRefresher } from "./refreshImportedSeason.js";

export const routeLeagueConnectionResource = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  connectionId: string,
): Promise<PlatformHttpResponse> => {
  const account = await requireRequestAccount(app, request);
  const options = serviceOptionsFor(services);
  if (options === null) return leagueConnectionsUnavailable();

  if (request.method === "DELETE") {
    const removed = await options.repository.deleteConnection(account.id, connectionId);
    return removed ? { status: 200, body: { removed } } : connectionNotFound();
  }
  if (request.method !== "GET") return methodNotAllowed();

  const connection = await options.repository.findConnection(account.id, connectionId);
  if (connection === null) return connectionNotFound();
  const snapshot = await options.repository.findSnapshot(connectionId);
  const imported = await importedLeagueFor(
    services.onboardingRepository,
    account.id,
    connection,
  );

  return {
    status: 200,
    body: {
      connection: publicConnection(connection, imported),
      league: snapshot === null ? null : {
        settings: snapshot.settings,
        teams: snapshot.teams,
        matchups: snapshot.matchups,
        syncedAt: snapshot.syncedAt,
      },
    },
  };
};

export const routeLeagueConnectionSync = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  connectionId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  const options = serviceOptionsFor(services, importedSeasonRefresher(app, request));
  if (options === null) return leagueConnectionsUnavailable();

  const connection = await options.repository.findConnection(account.id, connectionId);
  if (connection === null) return connectionNotFound();
  const result = await syncLeagueConnection(options, connection, request.now ?? new Date());
  if (result.connection === null) return connectionNotFound();
  const imported = await importedLeagueFor(
    services.onboardingRepository,
    account.id,
    result.connection,
  );

  // A failed sync is still a successful request: the connection now carries the
  // status and the plain-language reason the owner needs to read.
  return { status: 200, body: { connection: publicConnection(result.connection, imported) } };
};
