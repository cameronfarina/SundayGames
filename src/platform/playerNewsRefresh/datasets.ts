import { fantasyProsNewsLimit, type FantasyProsClient } from "../../data/fantasyPros.js";
import { rawItemFromFantasyProsNews } from "../../data/fantasyProsNewsAdapter.js";
import { fetchRotowireRssNews } from "../../data/playerNewsProviderAdapters.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type {
  FantasyProsDatasetRefresh,
  FantasyProsDatasetRunResult,
} from "../fantasyProsRefresh.js";
import type { PlayerNewsRepository } from "../playerNews.js";
import type { PlayerNewsRefreshDependencies } from "./contracts.js";
import { storeNewsItems } from "./store.js";

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;

export const playerNewsCadenceMs = 15 * minuteMs;
export const playerNewsRetentionCadenceMs = 24 * hourMs;

/**
 * What player news adds to the daily FantasyPros quota, on top of the 61 the
 * ranking, projection, and catalog datasets spend:
 *   FantasyPros news  1 request x 96 cycles/day = 96
 *   RotoWire news     free RSS, no key          =  0
 *   retention sweep   no request at all         =  0
 * The refresh poll interval is shorter than this cadence, so the cadence is
 * what governs and 96 is the ceiling rather than an estimate.
 */
export const playerNewsDailyRequestBudget = 96;

const fantasyProsNewsRefresh = (
  client: FantasyProsClient,
  fantasyProsRepository: FantasyProsRepository,
  newsRepository: PlayerNewsRepository,
): FantasyProsDatasetRefresh => ({
  dataset: "news-fantasypros",
  cadenceMs: playerNewsCadenceMs,
  requestCount: 1,
  run: async (fetchedAt): Promise<FantasyProsDatasetRunResult> => {
    const items = await client.fetchNews({ limit: fantasyProsNewsLimit });
    // FantasyPros identifies the player by id and never spells the name in a
    // parseable position, so the catalog it already syncs supplies the name.
    const playerIds = [...new Set(items.flatMap(item =>
      item.playerId === undefined ? [] : [item.playerId]))];
    const players = await fantasyProsRepository.playersByIds(playerIds);
    const nameById = new Map(players.map(player => [player.playerId, player.playerName]));

    const rowCount = await storeNewsItems(
      newsRepository,
      items.map(item =>
        rawItemFromFantasyProsNews(item, fetchedAt, playerId => nameById.get(playerId))),
    );
    return { rowCount, failures: [] };
  },
});

const rotowireNewsRefresh = (
  newsRepository: PlayerNewsRepository,
): FantasyProsDatasetRefresh => ({
  dataset: "news-rotowire",
  cadenceMs: playerNewsCadenceMs,
  // A free RSS feed spends nothing against the FantasyPros quota.
  requestCount: 0,
  run: async (fetchedAt): Promise<FantasyProsDatasetRunResult> => ({
    rowCount: await storeNewsItems(newsRepository, await fetchRotowireRssNews({ fetchedAt })),
    failures: [],
  }),
});

// Two providers writing every fifteen minutes grow the table faster than the
// feed's own seven-day window admits, and nothing else was pruning it.
const newsRetentionRefresh = (
  newsRepository: PlayerNewsRepository,
): FantasyProsDatasetRefresh => ({
  dataset: "news-retention",
  cadenceMs: playerNewsRetentionCadenceMs,
  requestCount: 0,
  run: async (fetchedAt): Promise<FantasyProsDatasetRunResult> => ({
    rowCount: await newsRepository.deleteOlderThanRetention(new Date(fetchedAt)),
    failures: [],
  }),
});

export const playerNewsDatasetRefreshes = ({
  newsRepository,
  fantasyProsRepository,
  fantasyProsClient,
}: PlayerNewsRefreshDependencies): readonly FantasyProsDatasetRefresh[] => [
  ...(fantasyProsClient === undefined
    ? []
    : [fantasyProsNewsRefresh(fantasyProsClient, fantasyProsRepository, newsRepository)]),
  rotowireNewsRefresh(newsRepository),
  newsRetentionRefresh(newsRepository),
];
