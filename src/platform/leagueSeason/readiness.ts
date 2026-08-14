import type { AnyLeagueSeason, LeagueSeasonReadiness } from "./contracts.js";
import { defaultScoringSettings } from "./defaults.js";
import { validateAuctionBudget, validateSnakeDraft } from "./validateDraftFormat.js";
import { validatePublishLockState, validateTeamCount } from "./validateIdentity.js";
import { validateRosterMaximums, validateRosterSlots } from "./validateRoster.js";
import { validateScoringSettings } from "./validateScoring.js";

export const assessLeagueSeasonReadiness = (season: AnyLeagueSeason): LeagueSeasonReadiness => {
  const rosterSize = season.settings.roster.rosterSize;
  const format = season.settings.draftFormat === "snake"
    ? validateSnakeDraft(season.settings.snake, season.teams, rosterSize)
    : validateAuctionBudget(season.settings.auction, rosterSize);
  const setupChecks = [
    validateTeamCount(season),
    format,
    validateScoringSettings(season.settings.scoring ?? defaultScoringSettings),
    validateRosterSlots(season.settings.roster),
    validateRosterMaximums(season.settings.roster),
  ];
  const hasBlockers = setupChecks.some(check => check.status === "fail");
  const checks = [...setupChecks, validatePublishLockState(season, hasBlockers)];
  const blockers = checks.filter(check => check.severity === "blocker" && check.status === "fail")
    .map(check => check.message);
  const warnings = checks.filter(check => check.severity === "warning" && check.status === "warn")
    .map(check => check.message);
  return {
    status: blockers.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    canPublish: blockers.length === 0 && season.setupStatus === "draft",
    canLock: blockers.length === 0 && season.setupStatus === "published",
    blockers,
    warnings,
    checks,
  };
};
