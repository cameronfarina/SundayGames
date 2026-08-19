import type { ScoringSettings } from "./contracts.js";
import type { LeagueSeasonReadinessCheck } from "./readinessContracts.js";

export const validateScoringSettings = (
  settings: ScoringSettings,
): LeagueSeasonReadinessCheck => {
  const yardage = [settings.passingYards, settings.rushingYards, settings.receivingYards];
  const touchdowns = [
    settings.passingTouchdown,
    settings.rushingTouchdown,
    settings.receivingTouchdown,
  ];
  const valid = yardage.every(points => Number.isFinite(points) && points >= 0)
    && touchdowns.every(points => Number.isFinite(points) && points > 0)
    && Number.isFinite(settings.reception) && settings.reception >= 0;
  return {
    key: "scoring", label: "Scoring", status: valid ? "pass" : "fail", severity: "blocker",
    message: valid ? "League scoring is configured."
      : "Touchdown points must be greater than 0, and reception points cannot be negative.",
  };
};
