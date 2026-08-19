import type { PlayerNewsRepository, PlayerNewsStoredItem } from "../playerNews.js";
import type { FantasyProsPlayerNews } from "./contracts.js";

/** Only FantasyPros items carry the player id these blurbs join on. */
const fantasyProsProvider = "fantasypros";

/** The label FantasyPros puts on a report that concerns a player's health. */
const injuryCategory = "Injury";

/** Keyed by the stored `providerPlayerId`, which is a stringified FantasyPros id. */
export type FantasyProsPlayerNewsIndex = ReadonlyMap<string, FantasyProsPlayerNews>;

const itemDateMs = (item: PlayerNewsStoredItem): number =>
  Date.parse(item.publishedAt ?? item.fetchedAt);

const newsFrom = (item: PlayerNewsStoredItem): FantasyProsPlayerNews => ({
  headline: item.title,
  publishedAt: item.publishedAt ?? item.fetchedAt,
  injury: (item.categories ?? []).includes(injuryCategory),
});

export const emptyFantasyProsPlayerNewsIndex = (): FantasyProsPlayerNewsIndex => new Map();

/**
 * One blurb per player, the newest report winning. The repository already sorts
 * newest first, but the comparison is made here rather than inherited so the
 * result does not depend on a caller's ordering.
 */
export const buildFantasyProsPlayerNewsIndex = (
  items: readonly PlayerNewsStoredItem[],
): FantasyProsPlayerNewsIndex => {
  const newest = new Map<string, PlayerNewsStoredItem>();
  for (const item of items) {
    const playerId = item.providerPlayerId;
    if (item.provider !== fantasyProsProvider || playerId === undefined) continue;
    const existing = newest.get(playerId);
    if (existing !== undefined && itemDateMs(existing) >= itemDateMs(item)) continue;
    newest.set(playerId, item);
  }
  return new Map([...newest].map(([playerId, item]) => [playerId, newsFrom(item)]));
};

export const loadFantasyProsPlayerNewsIndex = async (
  repository: PlayerNewsRepository,
  now?: Date,
): Promise<FantasyProsPlayerNewsIndex> =>
  buildFantasyProsPlayerNewsIndex(await repository.recentItems(now));

export const fantasyProsNewsFor = (
  index: FantasyProsPlayerNewsIndex,
  fantasyProsPlayerId: number | undefined,
): FantasyProsPlayerNews | undefined =>
  fantasyProsPlayerId === undefined ? undefined : index.get(String(fantasyProsPlayerId));
