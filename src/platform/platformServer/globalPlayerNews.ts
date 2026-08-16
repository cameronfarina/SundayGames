import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import { loadPlayerEvidenceSourceRows } from "../../data/playerEvidenceSourceAdapters.js";
import { fetchRotowireRssNews, type RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import { playerNewsEvidencePath } from "../../liveDraftServer/constants.js";
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

const isGlobalPlayerNewsRequest = (request: IncomingMessage, url: URL): boolean =>
  request.method === "GET"
  && url.pathname === "/api/player-news"
  && !url.searchParams.has("seasonId");

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
  let evidenceRowsPromise: ReturnType<typeof loadPlayerEvidenceSourceRows> | undefined;
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
      const sourceMode = filters.source ?? "all";
      const evidenceRows = sourceMode === "rotowire-rss"
        ? []
        : await (evidenceRowsPromise ??= loadPlayerEvidenceSourceRows({ path: playerNewsEvidencePath }));
      let rawNewsItems: readonly RawPlayerNewsItem[] = [];
      if (sourceMode !== "local") {
        try {
          rawNewsItems = await fetchRotowireRssNews();
        } catch (error) {
          if (sourceMode === "rotowire-rss") throw error;
        }
      }
      metadataPromise ??= metadataFor(options.currentPlayerCatalogProvider);
      writeJson(response, 200, buildPlayerNewsFeed({
        draftState: emptyDraftState,
        evidenceRows,
        filters,
        localEvidencePath: playerNewsEvidencePath,
        playerMetadata: await metadataPromise,
        rawNewsItems,
      }));
    } catch {
      writeJson(response, 500, internalErrorBody);
    }
    return true;
  };
};
