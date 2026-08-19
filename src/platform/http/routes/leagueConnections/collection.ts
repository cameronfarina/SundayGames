import { leagueSyncProviderCatalog, syncLeagueConnection } from "../../../leagueSyncService.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import {
  credentialsFor,
  invalidProvider,
  leagueConnectionsUnavailable,
  providerFor,
  publicConnection,
  seasonFor,
  serviceOptionsFor,
} from "./context.js";
import { normalizedHandle } from "./handles.js";

export const routeLeagueConnectionCollection = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const account = await requireRequestAccount(app, request);
  const options = serviceOptionsFor(services);
  if (options === null) return leagueConnectionsUnavailable();

  if (request.method === "GET") {
    return {
      status: 200,
      body: {
        connections: (await options.repository.listConnections(account.id)).map(publicConnection),
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
  const now = request.now ?? new Date();
  const saved = await options.repository.saveConnection({
    accountId: account.id,
    provider,
    providerLeagueId: normalizedHandle(provider, providerLeagueId),
    season: seasonFor(request, request.body.season),
    displayName: optionalString(request.body.displayName) ?? "Connected league",
    ...(credentials === undefined ? {} : { credentials }),
    now,
  });
  const result = await syncLeagueConnection(options, saved, now);

  return { status: 201, body: { connection: publicConnection(result.connection) } };
};
