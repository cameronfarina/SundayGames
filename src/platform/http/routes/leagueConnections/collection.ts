import { leagueSyncProviderCatalog, syncLeagueConnection } from "../../../leagueSyncService.js";
import type { LeagueConnectionCredentialUpdate } from "../../../leagueConnections.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import {
  connectionNotFound,
  credentialsFor,
  invalidProvider,
  leagueConnectionsUnavailable,
  providerFor,
  publicConnection,
  seasonFor,
  serviceOptionsFor,
} from "./context.js";
import { normalizedHandle } from "./handles.js";
import { importedLeaguesByConnectionId } from "./importedLeague.js";

export const routeLeagueConnectionCollection = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const account = await requireRequestAccount(app, request);
  const options = serviceOptionsFor(services);
  if (options === null) return leagueConnectionsUnavailable();

  if (request.method === "GET") {
    const connections = await options.repository.listConnections(account.id);
    const imported = await importedLeaguesByConnectionId(
      services.onboardingRepository,
      account.id,
      connections,
    );
    return {
      status: 200,
      body: {
        connections: connections.map(connection =>
          publicConnection(connection, imported.get(connection.id))),
        providers: leagueSyncProviderCatalog(),
      },
    };
  }
  if (request.method !== "POST") return methodNotAllowed();

  const provider = providerFor(request.body.provider);
  if (provider === null) return invalidProvider();
  const providerLeagueId = optionalString(request.body.providerLeagueId);
  if (providerLeagueId === undefined) {
    return knownError(400, "league_required", "Choose which league to connect.");
  }
  const credentials = credentialsFor(request.body);
  const requestedCredentialMode = request.body.credentialMode;
  if (requestedCredentialMode !== undefined
    && requestedCredentialMode !== "public"
    && requestedCredentialMode !== "private") {
    return knownError(400, "invalid_credential_mode", "Choose public or private ESPN sync.");
  }
  if (provider !== "espn" && requestedCredentialMode !== undefined) {
    return knownError(400, "invalid_credential_mode", "Credential mode is only used for ESPN.");
  }
  if (requestedCredentialMode === "public" && credentials !== undefined) {
    return knownError(400, "invalid_credentials", "Public ESPN sync must not include credentials.");
  }
  if (requestedCredentialMode === "private"
    && (credentials?.espnS2 === undefined || credentials.swid === undefined)) {
    return knownError(400, "credentials_required", "Private ESPN sync needs both ESPN cookies.");
  }
  const credentialUpdate: LeagueConnectionCredentialUpdate | undefined =
    requestedCredentialMode === "public"
    ? { mode: "clear" }
    : credentials === undefined
      ? undefined
      : { credentials, mode: "replace" };
  const now = request.now ?? new Date();
  const saved = await options.repository.saveConnection({
    accountId: account.id,
    provider,
    providerLeagueId: normalizedHandle(provider, providerLeagueId),
    season: seasonFor(request, request.body.season),
    displayName: optionalString(request.body.displayName) ?? "Connected league",
    ...(credentialUpdate === undefined ? {} : { credentialUpdate }),
    now,
  });
  const result = await syncLeagueConnection(options, saved, now);
  if (result.connection === null) return connectionNotFound();

  return { status: 201, body: { connection: publicConnection(result.connection) } };
};
