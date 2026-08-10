import { describe, expect, it } from "vitest";
import {
  loadPlatformOnboarding,
  PostgresPlatformOnboardingRepository,
  type PlatformOnboardingRow,
} from "../src/platform/platformOnboarding.js";
import type { PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

class OnboardingClient {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  constructor(readonly rows: PlatformOnboardingRow[]) {}

  async query<TRow>(sql: string, params: readonly unknown[] = []): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ sql, params });
    return { rows: this.rows as TRow[], rowCount: this.rows.length };
  }
}

describe("platform onboarding", () => {
  it("loads durable membership, claimed team, readiness, and live room identity", async () => {
    const client = new OnboardingClient([{
      league_id: "league_1",
      league_name: "Sunday Games",
      season_id: "season_2026",
      season_year: 2026,
      season_status: "published",
      role: "owner",
      team_id: "team_cam",
      team_key: "cam",
      team_name: "Cam's Team",
      owner_name: "Cam",
      room_id: "room_2026",
      room_status: "setup",
      draft_scheduled_at: "2026-08-29T18:00:00.000Z",
    }]);
    const repository = new PostgresPlatformOnboardingRepository(client);

    const snapshot = await loadPlatformOnboarding(repository, {
      account: { id: "acct_cam", email: "cam@example.com" },
    });

    expect(snapshot).toEqual({
      account: { id: "acct_cam", email: "cam@example.com" },
      leagues: [{
        leagueId: "league_1",
        leagueName: "Sunday Games",
        seasonId: "season_2026",
        seasonYear: 2026,
        membership: {
          role: "owner",
          ownerId: "cam",
          teamId: "team_cam",
          ownerDisplayName: "Cam",
          teamDisplayName: "Cam's Team",
        },
        canManageLeague: true,
        readiness: {
          leagueSetup: "ready",
          teamClaim: "ready",
          liveDraft: "ready",
        },
        nextDraftAt: "2026-08-29T18:00:00.000Z",
        liveDraft: { roomId: "room_2026", status: "setup" },
      }],
    });
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.params).toEqual(["acct_cam"]);
    expect(client.queries[0]?.sql).toContain("lm.user_id = $1");
    expect(client.queries[0]?.sql).toContain("ft.owner_user_id = lm.user_id");
  });

  it("keeps members out of commissioner setup and reports missing readiness", async () => {
    const client = new OnboardingClient([{
      league_id: "league_1",
      league_name: "Sunday Games",
      season_id: "season_2026",
      season_year: 2026,
      season_status: "draft",
      role: "member",
      team_id: null,
      team_key: null,
      team_name: null,
      owner_name: null,
      room_id: null,
      room_status: null,
      draft_scheduled_at: null,
    }]);

    const snapshot = await loadPlatformOnboarding(new PostgresPlatformOnboardingRepository(client), {
      account: { id: "acct_seth", email: "seth@example.com" },
    });

    expect(snapshot.leagues[0]).toMatchObject({
      canManageLeague: false,
      membership: { role: "member" },
      readiness: {
        leagueSetup: "needs_attention",
        teamClaim: "needs_attention",
        liveDraft: "needs_attention",
      },
      liveDraft: null,
    });
  });
});
