import { LeagueCreationError } from "../../../leagueCreation.js";
import { leagueImportConversion } from "../../../leagueImportFromSync.js";
import type { LeagueConnection, StoredLeagueSnapshot } from "../../../leagueConnections.js";
import type { LeagueSeason } from "../../../leagueSeason.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { isPlatformHttpResponse, methodNotAllowed } from "../../responses.js";
import {
  connectionNotFound,
  leagueConnectionsUnavailable,
  publicConnection,
  serviceOptionsFor,
} from "./context.js";
import { importedLeagueFor } from "./importedLeague.js";
import {
  importModeFrom,
  importNeedsReview,
  invalidImportMode,
  leagueSetupLocked,
  snapshotRequired,
} from "./importModes.js";
import { createdImportSeason, overwrittenImportSeason } from "./importSeason.js";

const importedBody = async (
  services: PlatformHttpServices,
  accountId: string,
  connection: LeagueConnection,
): Promise<PlatformHttpResponse> => {
  const imported = await importedLeagueFor(services.onboardingRepository, accountId, connection);
  return {
    status: 200,
    body: { connection: publicConnection(connection, imported), imported },
  };
};

const writtenSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  accountId: string,
  snapshot: StoredLeagueSnapshot,
  connection: LeagueConnection,
): Promise<LeagueSeason | PlatformHttpResponse> => {
  const mode = importModeFrom(request.body);
  if (mode === null) return invalidImportMode();
  const conversion = leagueImportConversion({
    provider: connection.provider,
    providerLeagueId: connection.providerLeagueId,
    settings: snapshot.settings,
    teams: snapshot.teams,
  });
  if (conversion.status === "blocked") return importNeedsReview(conversion.issues);
  if (mode.mode === "create") {
    return await createdImportSeason(app, request, accountId, conversion.input);
  }

  const existing = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: mode.seasonId,
    now: request.now,
  });
  // A room already built from this season's draft board must not be rewritten
  // underneath the people sitting in it.
  if (await app.hasLiveDraftRoomForSeason(existing.id)) return leagueSetupLocked();
  return await overwrittenImportSeason(app, request, existing, conversion.input);
};

export const routeLeagueConnectionImport = async (
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
  // Importing the same connection twice returns the league it already made
  // rather than a second copy of the owner's league.
  const alreadyImported = await importedLeagueFor(
    services.onboardingRepository,
    account.id,
    connection,
  );
  if (alreadyImported !== undefined && importModeFrom(request.body)?.mode === "create") {
    return await importedBody(services, account.id, connection);
  }
  const snapshot = await options.repository.findSnapshot(connectionId);
  if (snapshot === null) return snapshotRequired();

  try {
    const season = await writtenSeason(app, request, account.id, snapshot, connection);
    if (isPlatformHttpResponse(season)) return season;
    await options.repository.linkConnectionToSeason(connection.id, season.id);
    const linked = { ...connection, leagueSeasonId: season.id };
    return await importedBody(services, account.id, linked);
  } catch (error) {
    // The creation domain refuses setups this conversion could not foresee;
    // the owner reads them alongside the ones it did.
    if (error instanceof LeagueCreationError) return importNeedsReview([error.message]);
    throw error;
  }
};
