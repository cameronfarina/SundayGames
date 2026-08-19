import type {
  AnyLeagueSeason,
  ExplicitLeagueSeason,
  ExplicitLeagueSeasonSettings,
  LeagueSeasonSettings,
} from "./contracts.js";
import { defaultScoringSettings } from "./defaults.js";

const rebuiltSettings = (
  settings: LeagueSeasonSettings,
  manualInflationMultiplier: number | undefined,
): ExplicitLeagueSeasonSettings => {
  const scoring = { ...defaultScoringSettings, ...settings.scoring };
  const manualInflation = manualInflationMultiplier === undefined
    ? {}
    : { manualInflationMultiplier };
  if (settings.draftFormat === "snake") {
    return {
      expectedTeamCount: settings.expectedTeamCount,
      draftFormat: "snake",
      scoring,
      snake: { ...settings.snake, order: [...settings.snake.order] },
      roster: settings.roster,
      keeperPolicy: settings.keeperPolicy,
      ...manualInflation,
    };
  }
  return {
    expectedTeamCount: settings.expectedTeamCount,
    draftFormat: "auction",
    scoring,
    auction: { ...settings.auction },
    roster: settings.roster,
    keeperPolicy: settings.keeperPolicy,
    ...manualInflation,
  };
};

export const normalizeLeagueSeasonSettings = (
  settings: LeagueSeasonSettings,
): ExplicitLeagueSeasonSettings =>
  rebuiltSettings(settings, settings.manualInflationMultiplier);

/**
 * Sets or clears the inflation number a commissioner typed. Clearing has to
 * drop the field rather than blank it, so the settings are rebuilt from
 * scratch the same way every other write path rebuilds them.
 */
export const withManualInflationMultiplier = (
  settings: LeagueSeasonSettings,
  manualInflationMultiplier: number | undefined,
): ExplicitLeagueSeasonSettings => rebuiltSettings(settings, manualInflationMultiplier);

export const normalizeLeagueSeason = (season: AnyLeagueSeason): ExplicitLeagueSeason => ({
  ...season,
  settings: normalizeLeagueSeasonSettings(season.settings),
});
