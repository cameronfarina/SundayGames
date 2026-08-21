import { describe, expect, it } from "vitest";
import { accountDashboardSchema } from "./accountDashboardSchema";

const league = {
  draft: {},
  draftFormat: "snake",
  leagueId: "league-1",
  leagueName: "Sunday Games",
  leagueSlug: "sunday-games",
  membershipRole: "member",
  metrics: {
    completedMocks: 0,
    historicalImportSeasons: 0,
    savedSimulationOutcomes: 0,
    simulationRuns: 0,
    simulationsCompleted: 0,
  },
  provider: "mockd",
  readiness: { leagueSetup: "ready", liveDraft: "needs_attention", teamClaim: "ready" },
  seasonId: "season-1",
  seasonStatus: "published",
  seasonYear: 2026,
  teamCount: 12,
};

describe("accountDashboardSchema", () => {
  it("accepts an account league summary", () => {
    expect(accountDashboardSchema.parse({ leagues: [league] }).leagues).toHaveLength(1);
  });

  it("rejects invalid activity counts", () => {
    expect(accountDashboardSchema.safeParse({
      leagues: [{ ...league, metrics: { ...league.metrics, completedMocks: -1 } }],
    }).success).toBe(false);
  });
});
