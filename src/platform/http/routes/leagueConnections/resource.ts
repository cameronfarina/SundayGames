import { syncLeagueConnection } from "../../../leagueSyncService.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import {
  leagueConnectionsUnavailable,
  publicConnection,
  serviceOptionsFor,
} from "./context.js";
import { importSyncedLeague } from "./importSyncedLeague.js";

const connectionNotFound = (): PlatformHttpResponse => knownError(
  404,
  "connection_not_found",
  "That connected league is no longer here.",
);

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

  return {
    status: 200,
    body: {
      connection: publicConnection(connection),
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
  const options = serviceOptionsFor(services);
  if (options === null) return leagueConnectionsUnavailable();

  const connection = await options.repository.findConnection(account.id, connectionId);
  if (connection === null) return connectionNotFound();
  const previousSnapshot = await options.repository.findSnapshot(connectionId);
  const now = request.now ?? new Date();
  const synced = await syncLeagueConnection(options, connection, now);
  const imported = synced.snapshot === undefined
    ? synced.connection
    : await importSyncedLeague({
      account,
      app,
      connection: synced.connection,
      previousSnapshot,
      repository: options.repository,
      sessionToken: request.sessionToken,
      snapshot: synced.snapshot,
      now,
    });

  return { status: 200, body: { connection: publicConnection(imported) } };
};
