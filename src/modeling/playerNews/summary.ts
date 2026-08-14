import type { PlayerNewsItem, PlayerNewsSummary } from "./feedContracts.js";

export const playerNewsSummaryFor = (
  items: readonly PlayerNewsItem[],
  filteredItems: readonly PlayerNewsItem[],
): PlayerNewsSummary => ({
  totalCount: items.length,
  filteredCount: filteredItems.length,
  moveUpCount: items.filter(item => item.draftAction === "Move up").length,
  watchCount: items.filter(item => item.draftAction === "Watch").length,
  fadeCount: items.filter(item => item.draftAction === "Fade").length,
  noChangeCount: items.filter(item => item.draftAction === "No model change").length,
});
