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
} from "./normalization.js";

const providerLabels: Record<RawPlayerNewsItem["provider"], string> = {
  "rotowire-rss": "RotoWire RSS",
  espn: "ESPN",
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

  return {
    id: `${item.provider}-${playerNewsSlugFor(item.providerItemId || item.title)}-${index + 1}`,
    providerItemId: item.providerItemId,
    player,
    normalizedPlayerName: playerNewsKeyFor(player),
    ...playerNewsItemMetadataFor(market),
    category: categoryForRawNews(item),
    headline: `${player}: ${ensureNewsSentence(item.title)}`,
    fantasyImpact: ensureNewsSentence(item.summary),
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
