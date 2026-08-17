import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import { fetchRotowireRssNews, type RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import { playerNewsFiltersFromQuery } from "../../liveDraftServer/playerNewsInput.js";
import {
  buildPlayerNewsFeed,
  type PlayerNewsDraftState,
  type PlayerNewsPlayerMetadata,
} from "../../modeling/playerNews.js";
import { platformSessionTokenForHeaders } from "../platformNodeHttp.js";
import { authRequiredBody, internalErrorBody, writeJson } from "../platformDraftToolsAdapter/responses.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";

const emptyDraftState: PlayerNewsDraftState = {
  availableTargets: [],
  events: [],
  owners: [],
};

// Player news is account-scoped, not league-scoped: the feed is public
// reporting plus our evidence rows, and the reader's follow list lives with
// their account. A seasonId in the query must not route news through the
// private draft tools, which would refuse leagues it cannot model.
const isGlobalPlayerNewsRequest = (request: IncomingMessage, url: URL): boolean =>
  request.method === "GET"
  && url.pathname === "/api/player-news";

const metadataFor = async (
  provider: CreatePlatformServerOptions["currentPlayerCatalogProvider"],
): Promise<readonly PlayerNewsPlayerMetadata[]> => {
  if (provider === undefined) return [];
  return (await provider()).map(player => ({
    name: player.name,
    normalizedPlayerName: normalizePlayerName(player.name),
    position: player.position,
    ...(player.teamAbbreviation === undefined
      ? {}
      : { teamAbbreviation: player.teamAbbreviation }),
  }));
};

export const createGlobalPlayerNewsHandler = (
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
) => {
  let metadataPromise: Promise<readonly PlayerNewsPlayerMetadata[]> | undefined;

  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://mockd.local");
    if (!isGlobalPlayerNewsRequest(request, url)) return false;

    try {
      const sessionToken = platformSessionTokenForHeaders(request.headers);
      const account = sessionToken === undefined
        ? null
        : await runtimeHolder.current().app.findAccountBySessionToken(sessionToken, options.now?.());
      if (account === null) {
        writeJson(response, 401, authRequiredBody);
        return true;
      }

      const filters = playerNewsFiltersFromQuery(url);
      let rawNewsItems: readonly RawPlayerNewsItem[] = [];
      try {
        rawNewsItems = await fetchRotowireRssNews();
      } catch {
        // A reporting outage empties the feed rather than breaking the page.
      }
      metadataPromise ??= metadataFor(options.currentPlayerCatalogProvider);
      writeJson(response, 200, buildPlayerNewsFeed({
        draftState: emptyDraftState,
        filters,
        playerMetadata: await metadataPromise,
        rawNewsItems,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "unhandled_platform_error",
        source: "global_player_news",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }));
      writeJson(response, 500, internalErrorBody);
    }
    return true;
  };
};
