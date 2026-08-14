import { liveDraftCommandsCsv, liveDraftCommandsJson } from "../../liveDraftSessionStore.js";
import { leagueSyncProviderStatuses, leagueSyncReadOnlyPolicy } from "../../modeling/leagueSync.js";
import { obsoleteFrontendPaths } from "../constants.js";
import { sendJson, sendText } from "../http.js";
import { yahooOAuthCallbackResponse, yahooOAuthStartResponse } from "../integrations/yahoo.js";
import {
  nominatedPlayerFromValue,
  nominatedPriceFromValue,
  seedFromValue,
} from "../mockInput.js";
import { mockDraftRequestFor } from "../mockState.js";
import type { RouteHandler } from "../runtimeContracts.js";
import { strategyKeyFromQuery } from "../routeHelpers.js";
import {
  sessionModeFromQueryForSession,
  watchOwnerFromQuery,
} from "../sessionInput.js";
import { unknownField } from "../unknownRecord.js";

export const handleReadRoutes: RouteHandler = async ({ request, response, url, context }) => {
  if (request.method !== "GET") return false;
  if (obsoleteFrontendPaths.has(url.pathname)) {
    sendJson(response, 410, {
      error: {
        code: "frontend_removed",
        message: "This server provides draft APIs only. Use the Mockd React application.",
      },
    });
    return true;
  }
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204, { "cache-control": "no-store" });
    response.end();
    return true;
  }
  if (url.pathname === "/api/state") {
    const draftSessionKey = context.enabledDraftSessionKeyFromQuery(url);
    sendJson(response, 200, await context.state.stateFor({
      draftSessionKey,
      mode: sessionModeFromQueryForSession(url, draftSessionKey),
      strategyKey: strategyKeyFromQuery(url),
      watchOwner: watchOwnerFromQuery(url),
    }));
    return true;
  }
  if (url.pathname === "/api/mock/state") {
    const strategyKey = strategyKeyFromQuery(url);
    sendJson(response, 200, await context.interactive.stateWithMockDraft({
      ...mockDraftRequestFor(
        strategyKey,
        seedFromValue(url.searchParams.get("seed")),
        nominatedPlayerFromValue(url.searchParams.get("nominatedPlayer")),
        nominatedPriceFromValue(url.searchParams.get("nominatedPrice")),
      ),
      draftSessionKey: context.enabledDraftSessionKeyFromQuery(url),
      watchOwner: watchOwnerFromQuery(url),
    }));
    return true;
  }
  if (url.pathname === "/api/player-news") {
    sendJson(response, 200, await context.state.playerNewsFor(url));
    return true;
  }
  if (url.pathname === "/api/my-expert") {
    sendJson(response, 200, await context.state.myExpertFor(url));
    return true;
  }
  if (url.pathname === "/api/sync/providers") {
    sendJson(response, 200, { policy: leagueSyncReadOnlyPolicy, providers: leagueSyncProviderStatuses() });
    return true;
  }
  if (url.pathname === "/api/sync/oauth/yahoo/start") {
    const body = yahooOAuthStartResponse(request);
    sendJson(response, unknownField(body, "error") === undefined ? 200 : 501, body);
    return true;
  }
  if (url.pathname === "/api/sync/oauth/yahoo/callback") {
    const result = yahooOAuthCallbackResponse(url);
    sendJson(response, result.statusCode, result.body);
    return true;
  }
  if (url.pathname === "/api/sync/sleeper/preview") {
    const identifier = url.searchParams.get("identifier")?.trim() ?? "";
    const season = url.searchParams.get("season")?.trim() || "2026";
    if (!identifier) {
      sendJson(response, 400, { provider: "sleeper", readOnly: true, error: "Sleeper username or league ID is required." });
      return true;
    }
    try {
      const provider = context.options.sleeperSyncPreviewProvider;
      if (!provider) throw new Error("Sleeper sync provider is unavailable.");
      sendJson(response, 200, await provider({ identifier, season }));
    } catch (error) {
      sendJson(response, 502, {
        provider: "sleeper",
        readOnly: true,
        identifier,
        season,
        error: error instanceof Error ? error.message : "Could not preview Sleeper sync.",
      });
    }
    return true;
  }
  if (url.pathname === "/api/export") {
    const draftSessionKey = context.enabledDraftSessionKeyFromQuery(url);
    const store = await context.stores.storeFor(
      draftSessionKey,
      sessionModeFromQueryForSession(url, draftSessionKey),
    );
    const commands = store.currentCommands();
    if (url.searchParams.get("format") === "csv") {
      sendText(response, 200, "text/csv", liveDraftCommandsCsv(commands));
    } else {
      sendText(response, 200, "application/json", liveDraftCommandsJson(commands));
    }
    return true;
  }
  if (url.pathname === "/api/export-bundle") {
    const draftSessionKey = context.enabledDraftSessionKeyFromQuery(url);
    const bundle = await context.state.exportBundleFor({
      draftSessionKey,
      mode: sessionModeFromQueryForSession(url, draftSessionKey),
      strategyKey: strategyKeyFromQuery(url),
    });
    sendText(response, 200, "application/json", `${JSON.stringify(bundle, null, 2)}\n`);
    return true;
  }
  return false;
};
