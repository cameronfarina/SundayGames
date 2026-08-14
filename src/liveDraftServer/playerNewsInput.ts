import type { PlayerNewsFilters, PlayerNewsSourceMode } from "../modeling/playerNews.js";

const sourceModeFromValue = (value: unknown): PlayerNewsSourceMode =>
  value === "local" || value === "rotowire-rss" || value === "all" ? value : "all";

export const playerNewsFiltersFromQuery = (url: URL): PlayerNewsFilters => {
  const query = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const draftAction = url.searchParams.get("action")?.trim();
  return {
    source: sourceModeFromValue(url.searchParams.get("source")),
    ...(query ? { query } : {}),
    ...(category ? { category } : {}),
    ...(draftAction ? { draftAction } : {}),
  };
};
