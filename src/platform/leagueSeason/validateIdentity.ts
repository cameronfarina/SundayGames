import type { AnyLeagueSeason } from "./contracts.js";
import type { LeagueSeasonReadinessCheck } from "./readinessContracts.js";

export const validateTeamCount = (season: AnyLeagueSeason): LeagueSeasonReadinessCheck => {
  const actual = season.teams.length;
  const expected = season.settings.expectedTeamCount;
  const supported = Number.isInteger(expected) && expected >= 4 && expected <= 20
    && actual >= 4 && actual <= 20;
  const identities = season.teams.every(team =>
    team.id.trim().length > 0 && team.displayName.trim().length > 0)
    && new Set(season.teams.map(team => team.id)).size === actual;
  const expectedCount = actual === expected;
  let message = `${actual}/${expected} teams are configured.`;
  if (!supported) message = "Leagues require between 4 and 20 teams.";
  else if (!expectedCount) message = `Expected ${expected} teams, but found ${actual}.`;
  else if (!identities) message = "Every team needs a unique non-blank ID and a non-blank name.";
  return {
    key: "team-count", label: "Team count",
    status: supported && identities && expectedCount ? "pass" : "fail",
    severity: "blocker", message,
  };
};

export const validatePublishLockState = (
  season: AnyLeagueSeason,
  hasBlockers: boolean,
): LeagueSeasonReadinessCheck => {
  if (hasBlockers) return {
    key: "publish-lock-state", label: "Publish and lock state", status: "fail",
    severity: "warning", message: "Fix season setup blockers before publishing or locking.",
  };
  if (season.setupStatus === "draft") return {
    key: "publish-lock-state", label: "Publish and lock state", status: "warn",
    severity: "warning", message: "Season is ready but has not been published.",
  };
  return {
    key: "publish-lock-state", label: "Publish and lock state", status: "pass",
    severity: "warning",
    message: season.setupStatus === "published"
      ? "Season is published and can be locked." : "Season is locked.",
  };
};
