import type { RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import { playerNewsAuctionFor } from "./auction.js";
import type { PlayerNewsItem } from "./feedContracts.js";
import { actionForRawNews, categoryForRawNews } from "./impact.js";
import type { PlayerNewsDraftContext } from "./internalContracts.js";
import { playerNewsItemMetadataFor } from "./itemMetadata.js";
import {
  ensureNewsSentence,
  normalizedNewsDate,
  playerNewsKeyFor,
  playerNewsSlugFor,
  withoutSourceCredit,
} from "./normalization.js";

const providerLabels: Record<RawPlayerNewsItem["provider"], string> = {
  "rotowire-rss": "RotoWire RSS",
  fantasypros: "FantasyPros",
};

// RotoWire splits the player off the front of the title, so the headline has to
// put it back. FantasyPros leaves the name in place and would read twice.
const headlineFor = (player: string, title: string): string => {
  const sentence = ensureNewsSentence(title);
  return playerNewsKeyFor(sentence).startsWith(playerNewsKeyFor(player))
    ? sentence
    : `${player}: ${sentence}`;
};

export const playerNewsItemFromRaw = (
  item: RawPlayerNewsItem,
  index: number,
  draftContext: PlayerNewsDraftContext,
): PlayerNewsItem => {
  const player = item.playerName ?? "NFL";
  const market = playerNewsAuctionFor(player, draftContext);
  const draftAction = actionForRawNews(item);
  const impactScore = draftAction === "Fade" ? -1 : draftAction === "Watch" ? -0.5 : 0;
  const sourceDate = normalizedNewsDate(item.publishedAt);
  const metadata = playerNewsItemMetadataFor(market);
  const analystImpact = ensureNewsSentence(withoutSourceCredit(item.analystImpact ?? ""));

  return {
    id: `${item.provider}-${playerNewsSlugFor(item.providerItemId || item.title)}-${index + 1}`,
    providerItemId: item.providerItemId,
    player,
    normalizedPlayerName: playerNewsKeyFor(player),
    ...metadata,
    // The provider naming the team beats a catalog lookup that had only a name.
    ...(item.providerTeamAbbreviation === undefined
      ? {}
      : { teamAbbreviation: item.providerTeamAbbreviation }),
    category: categoryForRawNews(item),
    ...(item.categories === undefined || item.categories.length === 0
      ? {}
      : { categories: [...item.categories] }),
    headline: headlineFor(player, item.title),
    fantasyImpact: ensureNewsSentence(withoutSourceCredit(item.summary)),
    ...(analystImpact === "" ? {} : { analystImpact }),
    ...(sourceDate ? { sourceDate } : {}),
    fetchedAt: item.fetchedAt,
    source: {
      provider: providerLabels[item.provider],
      ...(item.canonicalUrl ? { url: item.canonicalUrl } : {}),
      quality: "unreviewed",
    },
    draftAction,
    impactScore,
    auction: market.auction,
    availability: market.availability,
  };
};
