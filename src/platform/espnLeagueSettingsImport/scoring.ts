import { LeagueCreationError } from "../leagueCreation.js";
import { scoringStatIds } from "./constants.js";
import { finiteNumber, objectValue, requiredNumber, type JsonObject } from "./json.js";
import type { EspnScoringSettingsReview } from "./types.js";

const pointsFor = (settings: JsonObject, statId: number, label: string): number => {
  if (!Array.isArray(settings.scoringItems)) {
    throw new Error("ESPN response is missing settings.scoringSettings.scoringItems.");
  }
  const item = settings.scoringItems
    .map(objectValue)
    .find(candidate => candidate !== null && finiteNumber(candidate.statId) === statId);
  if (item === undefined || item === null) {
    throw new LeagueCreationError(
      `ESPN response is missing ${label}. Review scoring manually before continuing.`,
    );
  }
  return requiredNumber(item.points, label);
};

export const scoringFor = (settings: JsonObject): EspnScoringSettingsReview => ({
  pointsPerPassingYard: pointsFor(settings, scoringStatIds.passingYard, "passing yard points"),
  pointsPerPassingTouchdown: pointsFor(
    settings,
    scoringStatIds.passingTouchdown,
    "passing touchdown points",
  ),
  pointsPerRushingYard: pointsFor(settings, scoringStatIds.rushingYard, "rushing yard points"),
  pointsPerRushingTouchdown: pointsFor(
    settings,
    scoringStatIds.rushingTouchdown,
    "rushing touchdown points",
  ),
  pointsPerReceivingYard: pointsFor(settings, scoringStatIds.receivingYard, "receiving yard points"),
  pointsPerReceivingTouchdown: pointsFor(
    settings,
    scoringStatIds.receivingTouchdown,
    "receiving touchdown points",
  ),
  pointsPerReception: pointsFor(settings, scoringStatIds.reception, "reception points"),
});
