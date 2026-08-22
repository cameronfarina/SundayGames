import { describe, expect, it } from "vitest";
import {
  loadAccountDashboard,
  PostgresAccountDashboardRepository,
  type AccountDashboardRow,
} from "../src/platform/accountDashboard.js";
import type { PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

class DashboardClient {
  readonly queries: Array<{ sql: string; values: readonly unknown[] }> = [];

  constructor(private readonly rows: readonly AccountDashboardRow[]) {}

  query<TRow = Record<string, unknown>>(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ sql, values });
    return Promise.resolve({ rows: [...this.rows] as TRow[], rowCount: this.rows.length });
  }
}

const row = (overrides: Partial<AccountDashboardRow> = {}): AccountDashboardRow => ({
  league_id: "league-1",
  league_name: "Sunday Games",
  league_slug: "sunday-games",
  provider: "espn",
  season_id: "season-2026",
  season_year: 2026,
  season_status: "published",
  membership_role: "member",
  team_id: "team-1",
  team_name: "Red Zone Rebels",
  draft_format: "auction",
  team_count: 12,
  room_id: "room-1",
  room_status: "countdown",
  draft_starts_at: "2026-08-30T23:00:00.000Z",
  draft_timezone: "America/New_York",
  historical_import_seasons: "3",
  completed_mocks: "4",
  simulation_runs: "5",
  simulations_completed: "125",
  saved_simulation_outcomes: "7",
  ...overrides,
});

describe("account dashboard", () => {
  it("returns one current-season card with durable league and retained practice metrics", async () => {
    const client = new DashboardClient([row()]);
    const repository = new PostgresAccountDashboardRepository(client);

    await expect(loadAccountDashboard(repository, "account-1")).resolves.toEqual({ leagues: [{
      leagueId: "league-1",
      leagueName: "Sunday Games",
      leagueSlug: "sunday-games",
      provider: "espn",
      seasonId: "season-2026",
      seasonYear: 2026,
      seasonStatus: "published",
      membershipRole: "member",
      teamDisplayName: "Red Zone Rebels",
      draftFormat: "auction",
      teamCount: 12,
      readiness: {
        leagueSetup: "ready",
        teamClaim: "ready",
        liveDraft: "ready",
      },
      draft: {
        roomId: "room-1",
        status: "countdown",
        startsAt: "2026-08-30T23:00:00.000Z",
        timezone: "America/New_York",
      },
      metrics: {
        historicalImportSeasons: 3,
        completedMocks: 4,
        simulationRuns: 5,
        simulationsCompleted: 125,
        savedSimulationOutcomes: 7,
      },
    }] });

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.values).toEqual(["account-1"]);
  });

  it("normalizes legacy database values and reports missing setup", async () => {
    const repository = new PostgresAccountDashboardRepository(new DashboardClient([row({
      provider: null,
      season_status: "unknown",
      membership_role: "unknown",
      team_id: null,
      team_name: null,
      draft_format: null,
      room_id: null,
      room_status: null,
      draft_starts_at: null,
      draft_timezone: null,
      historical_import_seasons: 0,
      completed_mocks: 0,
      simulation_runs: 0,
      simulations_completed: 0,
      saved_simulation_outcomes: 0,
    })]));

    await expect(repository.listForAccount("account-1")).resolves.toEqual([
      expect.objectContaining({
        provider: "mockd",
        seasonStatus: "draft",
        membershipRole: "member",
        draftFormat: "auction",
        readiness: {
          leagueSetup: "needs_attention",
          teamClaim: "needs_attention",
          liveDraft: "needs_attention",
        },
        draft: {},
      }),
    ]);
  });
});
