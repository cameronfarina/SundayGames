import { describe, expect, it } from "vitest";
import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";
import {
  cleanLeagueSearch,
  leaguePath,
  selectLeagueForRoute,
} from "./leaguePaths";

const league = (slug: string, seasonId: string): OnboardingLeague => ({
  canManageLeague: true,
  leagueId: `league-${slug}`,
  leagueName: "Sunday Games",
  leagueSlug: slug,
  liveDraft: { roomId: "room-long-private-id", status: "setup" },
  membership: { role: "owner" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId,
  seasonYear: 2026,
});

describe("league paths", () => {
  it("keeps database identifiers out of public league URLs", () => {
    const active = league("sunday-games", "season-long-private-id");

    expect(leaguePath(active, "practice")).toBe("/leagues/sunday-games/practice");
    expect(leaguePath(active, "draft")).toBe("/leagues/sunday-games/draft");
    expect(leaguePath(active, "league")).toBe("/leagues/sunday-games");
  });

  it("selects a league by slug while retaining legacy season links", () => {
    const leagues = [
      league("sunday-games", "season-1"),
      league("work-league", "season-2"),
    ];

    expect(selectLeagueForRoute(leagues, "work-league", null)?.seasonId).toBe("season-2");
    expect(selectLeagueForRoute(leagues, undefined, "season-1")?.leagueSlug).toBe("sunday-games");
  });

  it("removes private routing identifiers while preserving page state", () => {
    const search = new URLSearchParams(
      "seasonId=season-1&roomId=room-1&runId=history-1&strategy=wr-heavy",
    );

    expect(cleanLeagueSearch(search).toString()).toBe("runId=history-1&strategy=wr-heavy");
  });
});
