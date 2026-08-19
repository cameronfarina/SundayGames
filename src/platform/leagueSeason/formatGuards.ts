import type {
  ExplicitLeagueSeason,
  LeagueSeason,
  SnakeLeagueSeasonSettings,
} from "./contracts.js";

export type SnakeLeagueSeason = LeagueSeason<SnakeLeagueSeasonSettings>;

/** The draft format sits inside settings, so narrowing needs a guard. */
export const isSnakeLeagueSeason = (
  season: ExplicitLeagueSeason,
): season is SnakeLeagueSeason => season.settings.draftFormat === "snake";
