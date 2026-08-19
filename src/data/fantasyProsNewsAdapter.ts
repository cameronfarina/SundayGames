import type { FantasyProsNewsItem } from "./fantasyPros.js";
import { tagsForNewsText, type RawPlayerNewsItem } from "./playerNewsProviderAdapters.js";

// FantasyPros titles lead with the player name and no colon separator, and the
// player is identified by id rather than by parsing the headline.
export const rawItemFromFantasyProsNews = (
  item: FantasyProsNewsItem,
  fetchedAt: string,
  playerNameFor?: (playerId: number) => string | undefined,
): RawPlayerNewsItem => {
  const playerName = item.playerId === undefined
    ? undefined
    : playerNameFor?.(item.playerId);

  return {
    provider: "fantasypros",
    providerItemId: String(item.itemId),
    ...(item.link === undefined ? {} : { canonicalUrl: item.link }),
    ...(playerName === undefined ? {} : { playerName }),
    title: item.title,
    summary: item.description,
    publishedAt: item.createdAt,
    fetchedAt,
    tags: tagsForNewsText(item.title, item.description),
    categories: [...item.categories],
    ...(item.impact === undefined ? {} : { analystImpact: item.impact }),
    ...(item.playerId === undefined ? {} : { providerPlayerId: String(item.playerId) }),
    ...(item.teamAbbreviation === undefined
      ? {}
      : { providerTeamAbbreviation: item.teamAbbreviation }),
    raw: item,
  };
};
