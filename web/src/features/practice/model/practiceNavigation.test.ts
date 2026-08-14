import { describe, expect, it } from "vitest";
import type { PracticeLeague } from "../api/practiceContextSchema";
import { practiceStrategy, selectedPracticeLeague } from "./practiceNavigation";

const league = (seasonId: string): PracticeLeague => ({
  canManageLeague: false,
  leagueId: `league-${seasonId}`,
  leagueName: seasonId,
  liveDraft: null,
  membership: { role: "member" },
  readiness: { leagueSetup: "ready", liveDraft: "needs_attention", teamClaim: "needs_attention" },
  seasonId,
  seasonYear: 2026,
});

describe("practice navigation", () => {
  it.each(["hero-rb", "three-rb", "wr-heavy"])("accepts the %s strategy", value => {
    expect(practiceStrategy(value)).toBe(value);
  });

  it("uses balanced for absent and unsupported strategies", () => {
    expect(practiceStrategy(null)).toBe("balanced");
    expect(practiceStrategy("surprise")).toBe("balanced");
  });

  it("selects a requested league, then falls back to the first league", () => {
    const leagues = [league("one"), league("two")];
    expect(selectedPracticeLeague(leagues, "two")?.seasonId).toBe("two");
    expect(selectedPracticeLeague(leagues, "missing")?.seasonId).toBe("one");
    expect(selectedPracticeLeague(leagues, "baseline")).toBeUndefined();
    expect(selectedPracticeLeague([], null)).toBeUndefined();
  });
});
