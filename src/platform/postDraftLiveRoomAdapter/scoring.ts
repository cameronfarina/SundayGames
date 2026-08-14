import { createHash } from "node:crypto";
import {
  normalizeLeagueSeasonSettings,
  type LeagueSeason,
} from "../leagueSeason.js";

const scoringDocumentFor = (season: LeagueSeason): string => {
  const scoring = normalizeLeagueSeasonSettings(season.settings).scoring;

  return JSON.stringify({
    passingYards: scoring.passingYards,
    passingTouchdown: scoring.passingTouchdown,
    rushingYards: scoring.rushingYards,
    rushingTouchdown: scoring.rushingTouchdown,
    receivingYards: scoring.receivingYards,
    receivingTouchdown: scoring.receivingTouchdown,
    reception: scoring.reception,
  });
};

export const postDraftScoringSettingsIdForSeason = (season: LeagueSeason): string =>
  `${season.id}:scoring:${createHash("sha256")
    .update(scoringDocumentFor(season))
    .digest("hex")
    .slice(0, 16)}`;
