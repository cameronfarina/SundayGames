import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";

export const practiceStrategy = (value: string | null): string => {
  if (value === "hero-rb") return value;
  if (value === "three-rb") return value;
  if (value === "wr-heavy") return value;
  return "balanced";
};

export const selectedPracticeLeague = (
  leagues: readonly OnboardingLeague[],
  requestedSeasonId: string | null,
): OnboardingLeague | undefined => requestedSeasonId === "baseline"
  ? undefined
  : leagues.find(league => league.seasonId === requestedSeasonId) ?? leagues[0];
