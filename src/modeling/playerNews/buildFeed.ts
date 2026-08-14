import { newestPlayerNewsFirst } from "./chronology.js";
import { playerNewsDraftContextFor } from "./draftContext.js";
import { playerNewsItemFromEvidence } from "./evidenceItem.js";
import { matchesPlayerNewsFilters, playerNewsSourceModeFrom } from "./filters.js";
import type { BuildPlayerNewsFeedOptions, PlayerNewsFeed } from "./feedContracts.js";
import { playerNewsProviderStatuses } from "./providers.js";
import { playerNewsItemFromRaw } from "./rawItem.js";
import { playerNewsSummaryFor } from "./summary.js";

export const buildPlayerNewsFeed = ({
  evidenceRows = [],
  rawNewsItems = [],
  playerMetadata = [],
  draftState,
  filters = {},
  generatedAt = new Date().toISOString(),
  localEvidencePath = "data/raw/player-evidence-2026-initial.csv",
}: BuildPlayerNewsFeedOptions): PlayerNewsFeed => {
  const sourceMode = playerNewsSourceModeFrom(filters.source);
  const draftContext = playerNewsDraftContextFor(draftState, playerMetadata);
  const localItems = sourceMode === "rotowire-rss"
    ? []
    : evidenceRows.map((evidence, index) =>
      playerNewsItemFromEvidence(evidence, index, draftContext));
  const rawItems = sourceMode === "local"
    ? []
    : rawNewsItems.map((item, index) => playerNewsItemFromRaw(item, index, draftContext));
  const items = newestPlayerNewsFirst([...localItems, ...rawItems]);
  const filteredItems = items.filter(item => matchesPlayerNewsFilters(item, filters));

  return {
    sourceMode,
    generatedAt,
    summary: playerNewsSummaryFor(items, filteredItems),
    providers: playerNewsProviderStatuses(localEvidencePath),
    items: filteredItems,
  };
};
