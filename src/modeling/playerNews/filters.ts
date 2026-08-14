import type { PlayerNewsSourceMode } from "./categoryContracts.js";
import type { PlayerNewsFilters, PlayerNewsItem } from "./feedContracts.js";

export const playerNewsSourceModeFrom = (
  value: string | undefined,
): PlayerNewsSourceMode => {
  if (value === "local" || value === "rotowire-rss" || value === "all") return value;
  return "all";
};

export const matchesPlayerNewsFilters = (
  item: PlayerNewsItem,
  filters: PlayerNewsFilters,
): boolean => {
  if (filters.category && filters.category !== "All" && item.category !== filters.category) return false;
  if (filters.draftAction && filters.draftAction !== "All" && item.draftAction !== filters.draftAction) return false;

  const query = filters.query?.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    item.player,
    item.position,
    item.teamAbbreviation,
    item.category,
    item.headline,
    item.fantasyImpact,
    item.draftAction,
    item.source.provider,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
};
