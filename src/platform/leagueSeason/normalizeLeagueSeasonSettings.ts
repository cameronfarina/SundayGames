import type {
  AnyLeagueSeason,
  ExplicitLeagueSeason,
  ExplicitLeagueSeasonSettings,
  LeagueSeasonSettings,
} from "./contracts.js";
import { defaultScoringSettings } from "./defaults.js";

export const normalizeLeagueSeasonSettings = (
  settings: LeagueSeasonSettings,
): ExplicitLeagueSeasonSettings => {
  const scoring = { ...defaultScoringSettings, ...settings.scoring };
  if (settings.draftFormat === "snake") {
    return {
      expectedTeamCount: settings.expectedTeamCount,
      draftFormat: "snake",
      scoring,
      snake: { ...settings.snake, order: [...settings.snake.order] },
      roster: settings.roster,
      keeperPolicy: settings.keeperPolicy,
    };
  }
  return {
    expectedTeamCount: settings.expectedTeamCount,
    draftFormat: "auction",
    scoring,
    auction: { ...settings.auction },
    roster: settings.roster,
    keeperPolicy: settings.keeperPolicy,
  };
};

export const normalizeLeagueSeason = (season: AnyLeagueSeason): ExplicitLeagueSeason => ({
  ...season,
  settings: normalizeLeagueSeasonSettings(season.settings),
});
