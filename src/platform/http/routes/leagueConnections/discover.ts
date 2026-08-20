import { discoverLeaguesForProvider } from "../../../leagueSyncService.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { leagueSyncErrorStatus } from "../../errors/leagueSyncStatus.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import {
  credentialsFor,
  invalidProvider,
  leagueConnectionsUnavailable,
  providerFor,
  seasonFor,
  serviceOptionsFor,
} from "./context.js";
import { normalizedHandle } from "./handles.js";

export const routeLeagueConnectionDiscovery = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  await requireRequestAccount(app, request);
  const options = serviceOptionsFor(services);
  if (options === null) return leagueConnectionsUnavailable();

  const provider = providerFor(request.body.provider);
  if (provider === null) return invalidProvider();
  // ESPN is the one provider that can list an account's leagues without being
  // told which one, so only there does a blank handle mean something.
  const handle = optionalString(request.body.handle) ?? "";
  if (handle.length === 0 && provider !== "espn") {
    return knownError(400, "handle_required", "Enter the league or username to look up.");
  }
  const credentials = credentialsFor(request.body);
  const season = seasonFor(request, request.body.season);
  const discovery = await discoverLeaguesForProvider(options, {
    provider,
    handle: normalizedHandle(provider, handle),
    season,
    ...(credentials === undefined ? {} : { credentials }),
  });

  if (discovery.failure === undefined) {
    return { status: 200, body: { leagues: discovery.leagues, provider, season } };
  }
  const { code, message } = discovery.failure;
  return knownError(
    code === "sync_failed" ? 502 : leagueSyncErrorStatus(code),
    code,
    message,
  );
};
