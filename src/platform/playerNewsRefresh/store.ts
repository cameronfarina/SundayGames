import type {
  RawPlayerNewsItem,
  RawPlayerNewsProvider,
} from "../../data/playerNewsProviderAdapters.js";
import type {
  PlayerNewsRepository,
  PlayerNewsStoredItem,
  SavePlayerNewsItemInput,
} from "../playerNews.js";

export const saveInputFromRaw = (item: RawPlayerNewsItem): SavePlayerNewsItemInput => ({
  provider: item.provider,
  providerItemId: item.providerItemId,
  canonicalUrl: item.canonicalUrl,
  playerName: item.playerName,
  title: item.title,
  summary: item.summary,
  publishedAt: item.publishedAt,
  fetchedAt: item.fetchedAt,
  tags: item.tags,
  categories: item.categories,
  analystImpact: item.analystImpact,
  providerPlayerId: item.providerPlayerId,
  providerTeamAbbreviation: item.providerTeamAbbreviation,
});

export const storeNewsItems = async (
  repository: PlayerNewsRepository,
  items: readonly RawPlayerNewsItem[],
): Promise<number> => {
  if (items.length === 0) return 0;
  await repository.saveItems(items.map(saveInputFromRaw));
  return items.length;
};

// Stored items from a provider we no longer read are skipped here, so dropping
// a source retires its rows without a migration.
const rawPlayerNewsProviderValues = new Set<string>(
  ["rotowire-rss", "fantasypros"] satisfies RawPlayerNewsProvider[],
);

const isRawPlayerNewsProvider = (value: string): value is RawPlayerNewsProvider =>
  rawPlayerNewsProviderValues.has(value);

export const rawItemFromStored = (
  item: PlayerNewsStoredItem,
): RawPlayerNewsItem | undefined => {
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
    ...(item.categories === undefined ? {} : { categories: item.categories }),
    ...(item.analystImpact === undefined ? {} : { analystImpact: item.analystImpact }),
    ...(item.providerPlayerId === undefined
      ? {}
      : { providerPlayerId: item.providerPlayerId }),
    ...(item.providerTeamAbbreviation === undefined
      ? {}
      : { providerTeamAbbreviation: item.providerTeamAbbreviation }),
    raw: undefined,
  };
};
