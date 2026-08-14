const teamClaimUniqueConstraint = "fantasy_teams_season_owner_user_key";

export class TeamClaimUnavailableError extends Error {}

export const isTeamClaimUniqueViolation = (error: unknown): boolean =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  "constraint" in error &&
  error.code === "23505" &&
  error.constraint === teamClaimUniqueConstraint;
