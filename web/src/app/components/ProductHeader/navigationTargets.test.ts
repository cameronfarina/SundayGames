import { describe, expect, it } from "vitest";
import {
  onboardingLeagueSchema,
  type OnboardingLeague,
} from "../../../shared/api/onboarding/onboardingSchema";
import { navigationTargets } from "./navigationTargets";

const league: OnboardingLeague = onboardingLeagueSchema.parse({
  canManageLeague: true,
  leagueId: "league-1",
  leagueName: "The Sunday Games",
  leagueSlug: "sunday games",
  liveDraft: null,
  membership: { role: "owner" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId: "season-a",
  seasonYear: 2026,
});

describe("navigationTargets", () => {
  it("points every page at the active league", () => {
    expect(navigationTargets(league, false)).toEqual([
      { label: "Practice", page: "practice", to: "/leagues/sunday%20games/practice" },
      { label: "Player news", page: "player-news", to: "/leagues/sunday%20games/player-news" },
      { label: "League", page: "league", to: "/leagues/sunday%20games" },
      { label: "My team", page: "my-team", to: "/leagues/sunday%20games/my-team" },
    ]);
  });

  it("adds the commissioner page only for a manager who can run the league", () => {
    expect(navigationTargets(league, true).map(target => target.label))
      .toEqual(["Practice", "Player news", "League", "My team", "Commissioner"]);
  });

  it("falls back to the plain paths before a league is chosen", () => {
    expect(navigationTargets(undefined, true).map(target => target.to))
      .toEqual(["/practice", "/player-news", "/league", "/my-team", "/commissioner"]);
  });
});
