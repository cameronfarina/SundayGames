import type { ExplicitLeagueSeason, SnakeLeagueSeason } from "./contracts.js";

/** The draft format sits inside settings, so narrowing needs a guard. */
export const isSnakeLeagueSeason = (
  season: ExplicitLeagueSeason,
): season is SnakeLeagueSeason => season.settings.draftFormat === "snake";
