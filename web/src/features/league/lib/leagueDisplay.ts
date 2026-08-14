import type { LeagueOnboarding, OnboardingLeague } from "../api/leagueSchemas";
import type { LeagueSeasonSettings } from "../api/seasonSchemas";

export const selectActiveLeague = (
  onboarding: LeagueOnboarding,
  requestedSeasonId: string | null,
): OnboardingLeague | undefined => requestedSeasonId === null
  ? onboarding.leagues[0]
  : onboarding.leagues.find((league) => league.seasonId === requestedSeasonId);

export const describeDraft = (settings: LeagueSeasonSettings): string => {
  if ("draftFormat" in settings && settings.draftFormat === "snake") {
    const reversal = settings.snake.reversal === "standard" ? "Standard" : "Third-round";
    return `${String(settings.snake.rounds)}-round snake · ${reversal} reversal`;
  }

  return `$${String(settings.auction.budgetDollars)} auction · $${String(settings.auction.minimumBidDollars)} minimum bid`;
};

export const describeScoring = (settings: LeagueSeasonSettings): string => {
  if (!("scoring" in settings)) return "Scoring details unavailable";
  return `${String(settings.scoring.reception)} PPR · ${String(settings.scoring.passingTouchdown)} point pass TD`;
};

const rosterOrder = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K", "BENCH"];

export const describeRoster = (settings: LeagueSeasonSettings): string => {
  const slots = rosterOrder.flatMap((slot) => {
    const count = settings.roster.lineup[slot];
    return count === undefined || count === 0 ? [] : [`${String(count)} ${slot}`];
  });
  return `${String(settings.roster.rosterSize)} players · ${slots.join(", ")}`;
};
