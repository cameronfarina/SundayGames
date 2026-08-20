import { LeagueCreationError } from "../../../leagueCreation.js";
import type { LeagueConnection } from "../../../leagueConnections.js";
import { convergeImportedSeason } from "../../../leagueSyncService/importedSeasonConvergence.js";
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
import { importedSeasonRefresher } from "./refreshImportedSeason.js";
import { refreshedLeagueImportConversion } from "./importConversion.js";
import {
  importModeFrom,
  importNeedsReview,
  invalidImportMode,
  leagueImportChanged,
  snapshotRequired,
} from "./importModes.js";
import { writeImportSeason } from "./importSeason.js";

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

const runWithSeasonWriteAccess = async <T>(
  services: PlatformHttpServices,
  operation: () => Promise<T>,
): Promise<T> => services.runLeagueSyncSeasonRefresh === undefined
  ? await operation()
  : await services.runLeagueSyncSeasonRefresh(operation);

const convergedImportResponse = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  repository: NonNullable<PlatformHttpServices["leagueConnectionRepository"]>,
  accountId: string,
  connection: LeagueConnection,
): Promise<PlatformHttpResponse> => {
  const converged = await convergeImportedSeason(
    repository,
    connection,
    importedSeasonRefresher(app, request),
  );
  if (converged.connection === null) return connectionNotFound();
  if (!converged.stable) return leagueImportChanged();
  if (converged.detail !== null) return importNeedsReview([converged.detail]);
  return await importedBody(services, accountId, converged.connection);
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
  const mode = importModeFrom(request.body);
  if (mode === null) return invalidImportMode();

  const connection = await options.repository.findConnection(account.id, connectionId);
  if (connection === null) return connectionNotFound();
  try {
    // Importing the same connection twice returns the league it already made
    // rather than a second copy of the owner's league.
    const alreadyImported = await importedLeagueFor(
      services.onboardingRepository,
      account.id,
      connection,
    );
    if (alreadyImported !== undefined && mode.mode === "create") {
      return await runWithSeasonWriteAccess(services, async () =>
        await convergedImportResponse(
          app, request, services, options.repository, account.id, connection,
        )
      );
    }
    const snapshot = await options.repository.findSnapshot(connectionId);
    if (snapshot === null) return snapshotRequired();
    const conversion = await refreshedLeagueImportConversion(
      options,
      connection,
      snapshot,
      request.now ?? new Date(),
    );
    if (conversion === null) return connectionNotFound();

    return await runWithSeasonWriteAccess(services, async () => {
      const current = await options.repository.findConnection(account.id, connectionId);
      if (current === null) return connectionNotFound();
      if (mode.mode === "create") {
        const imported = await importedLeagueFor(
          services.onboardingRepository,
          account.id,
          current,
        );
        if (imported !== undefined) {
          return await convergedImportResponse(
            app, request, services, options.repository, account.id, current,
          );
        }
      }
      const season = await writeImportSeason(
        app, request, account.id, current.id, mode, conversion,
      );
      if (isPlatformHttpResponse(season)) return season;
      if (app.leagueSetupRepository.registerLeagueSeasonWithConnection === undefined) {
        await options.repository.linkConnectionToSeason(current.id, season.id);
      }
      const linked = { ...current, leagueSeasonId: season.id };
      return await convergedImportResponse(
        app, request, services, options.repository, account.id, linked,
      );
    });
  } catch (error) {
    // The creation domain refuses setups this conversion could not foresee;
    // the owner reads them alongside the ones it did.
    if (error instanceof LeagueCreationError) return importNeedsReview([error.message]);
    throw error;
  }
};
