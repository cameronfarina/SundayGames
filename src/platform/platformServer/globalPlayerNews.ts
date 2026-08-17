import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchEspnNews } from "../../data/espnPlayerNewsAdapter.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import {
  fetchRotowireRssNews,
  type RawPlayerNewsItem,
  type RawPlayerNewsProvider,
} from "../../data/playerNewsProviderAdapters.js";
import { playerNewsFiltersFromQuery } from "../../liveDraftServer/playerNewsInput.js";
import {
  buildPlayerNewsFeed,
  type PlayerNewsDraftState,
  type PlayerNewsPlayerMetadata,
} from "../../modeling/playerNews.js";
import type { PlayerNewsRepository, PlayerNewsStoredItem, SavePlayerNewsItemInput } from "../playerNews.js";
import { platformSessionTokenForHeaders } from "../platformNodeHttp.js";
import { authRequiredBody, internalErrorBody, writeJson } from "../platformDraftToolsAdapter/responses.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";

const emptyDraftState: PlayerNewsDraftState = {
  availableTargets: [],
  events: [],
  owners: [],
};

const rawPlayerNewsProviderValues = new Set<string>(
  ["rotowire-rss", "espn"] satisfies RawPlayerNewsProvider[],
);

const isRawPlayerNewsProvider = (value: string): value is RawPlayerNewsProvider =>
  rawPlayerNewsProviderValues.has(value);

const saveInputFromRaw = (item: RawPlayerNewsItem): SavePlayerNewsItemInput => ({
  provider: item.provider,
  providerItemId: item.providerItemId,
  canonicalUrl: item.canonicalUrl,
  playerName: item.playerName,
  title: item.title,
  summary: item.summary,
  publishedAt: item.publishedAt,
  fetchedAt: item.fetchedAt,
  tags: item.tags,
});

const rawItemFromStored = (item: PlayerNewsStoredItem): RawPlayerNewsItem | undefined => {
  if (!isRawPlayerNewsProvider(item.provider)) return undefined;
  return {
    provider: item.provider,
    providerItemId: item.providerItemId,
    ...(item.canonicalUrl === undefined ? {} : { canonicalUrl: item.canonicalUrl }),
    ...(item.playerName === undefined ? {} : { playerName: item.playerName }),
    title: item.title,
    summary: item.summary,
    ...(item.publishedAt === undefined ? {} : { publishedAt: item.publishedAt }),
    fetchedAt: item.fetchedAt,
    tags: item.tags,
    raw: undefined,
  };
};

// Every source is fetched independently so one outage (ESPN down, RotoWire
// rate-limited) never empties the other's items out of the stored feed.
const fetchAndStoreLatestNews = async (repository: PlayerNewsRepository): Promise<void> => {
  const results = await Promise.allSettled([fetchRotowireRssNews(), fetchEspnNews()]);
  const items = results.flatMap(result => (result.status === "fulfilled" ? result.value : []));
  if (items.length > 0) await repository.saveItems(items.map(saveInputFromRaw));
};

// Player news is account-scoped, not league-scoped: the feed is published
// reporting, and the reader's follow list lives with their account. A seasonId
// in the query must not route news through the private draft tools, which
// would refuse leagues it cannot model.
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
      const repository = runtimeHolder.current().playerNewsRepository;
      try {
        await fetchAndStoreLatestNews(repository);
      } catch {
        // A reporting outage serves the last stored items rather than breaking the page.
      }
      const rawNewsItems = (await repository.recentItems()).flatMap(item => {
        const raw = rawItemFromStored(item);
        return raw === undefined ? [] : [raw];
      });
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
