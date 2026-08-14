import { describe, expect, it, vi } from "vitest";
import {
  InMemoryPlatformOnboardingRepository,
  loadPlatformOnboarding,
  PostgresPlatformOnboardingRepository,
  type PlatformOnboardingRow,
} from "../src/platform/platformOnboarding.js";
import type { PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import { InMemoryPlatformStore } from "../src/platform/platformApp.js";

class OnboardingClient {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  constructor(readonly rows: PlatformOnboardingRow[]) {}

  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql, params });
    return { rows: this.rows, rowCount: this.rows.length };
  }
}

describe("platform onboarding", () => {
  it("builds its local source without cloning simulation or pricing history", () => {
    const store = new InMemoryPlatformStore();
    const simulationReads = vi.spyOn(store.simulations, "runs").mockImplementation(() => {
      throw new Error("onboarding must not read simulations");
    });
    const pricingReads = vi.spyOn(store.pricingSnapshots, "list").mockImplementation(() => {
      throw new Error("onboarding must not read pricing history");
    });

    expect(store.onboardingSnapshot()).toEqual({
      leagueSeasons: [],
      leagueCreationRecords: [],
      memberships: [],
      liveDraftRooms: [],
    });
    expect(simulationReads).not.toHaveBeenCalled();
    expect(pricingReads).not.toHaveBeenCalled();
  });
  it("builds the same onboarding view from the local platform snapshot", async () => {
    const repository = new InMemoryPlatformOnboardingRepository(() => ({
      leagueSeasons: [{
        id: "season_2026",
        leagueId: "league_1",
        league: {
          id: "league_1",
          externalLeagueId: "1",
          name: "Sunday Games",
          provider: "mockd",
        },
        seasonYear: 2026,
        setupStatus: "published",
        teams: [{
          id: "team_cam",
          leagueSeasonId: "season_2026",
          ownerId: "owner11",
          ownerDisplayName: "Owner11",
          displayName: "Owner11's Team",
          draftOrderPosition: 1,
        }],
        settings: {
          expectedTeamCount: 1,
          auction: { budgetDollars: 200, minimumBidDollars: 1 },
          roster: {
            rosterSize: 1,
            lineup: { QB: 1 },
            lineupSlotCount: 1,
            rosterMaximums: { QB: 1, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
          },
          keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
        },
        draft: { scheduledAt: "2026-08-29T18:00:00.000Z" },
      }],
      memberships: [{
        userId: "acct_owner11",
        leagueId: "league_1",
        role: "owner",
        ownerId: "owner11",
        teamId: "team_cam",
      }],
      liveDraftRooms: [{
        roomId: "room_2026",
        leagueId: "league_1",
        seasonId: "season_2026",
        status: "setup",
        startsAt: new Date("2026-08-29T18:00:00.000Z"),
        createdAt: new Date("2026-08-10T12:00:00.000Z"),
      }],
    }));

    const snapshot = await loadPlatformOnboarding(repository, {
      account: { id: "acct_owner11", email: "owner11@example.com" },
    });

    expect(snapshot.leagues).toEqual([{
      leagueId: "league_1",
      leagueName: "Sunday Games",
      seasonId: "season_2026",
      seasonYear: 2026,
      membership: {
        role: "owner",
        ownerId: "owner11",
        teamId: "team_cam",
        ownerDisplayName: "Owner11",
        teamDisplayName: "Owner11's Team",
      },
      canManageLeague: true,
      readiness: {
        leagueSetup: "ready",
        teamClaim: "ready",
        liveDraft: "ready",
      },
      nextDraftAt: "2026-08-29T18:00:00.000Z",
      liveDraft: { roomId: "room_2026", status: "setup" },
    }]);
  });

  it("excludes archived leagues from the local active-league picker", async () => {
    const repository = new InMemoryPlatformOnboardingRepository(() => ({
      leagueSeasons: [{
        id: "season_archived",
        leagueId: "league_archived",
        league: {
          id: "league_archived",
          externalLeagueId: "archived",
          name: "Archived League",
          provider: "mockd",
        },
        seasonYear: 2025,
        setupStatus: "published",
        teams: [],
        settings: {
          expectedTeamCount: 1,
          auction: { budgetDollars: 200, minimumBidDollars: 1 },
          roster: {
            rosterSize: 1,
            lineup: { QB: 1 },
            lineupSlotCount: 1,
            rosterMaximums: { QB: 1, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
          },
          keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
        },
      }],
      leagueCreationRecords: [{
        leagueId: "league_archived",
        createdByUserId: "acct_owner11",
        createdAt: new Date("2025-08-01T12:00:00.000Z"),
        archivedAt: new Date("2026-08-12T12:00:00.000Z"),
        archivedByUserId: "acct_owner11",
      }],
      memberships: [{ userId: "acct_owner11", leagueId: "league_archived", role: "owner" }],
      liveDraftRooms: [],
    }));

    await expect(repository.listForUser("acct_owner11")).resolves.toEqual([]);
  });

  it("loads durable membership, claimed team, readiness, and live room identity", async () => {
    const client = new OnboardingClient([{
      league_id: "league_1",
      league_name: "Sunday Games",
      season_id: "season_2026",
      season_year: 2026,
      season_status: "published",
      role: "owner",
      team_id: "team_cam",
      team_key: "owner11",
      team_name: "Owner11's Team",
      owner_name: "Owner11",
      room_id: "room_2026",
      room_status: "setup",
      draft_scheduled_at: "2026-08-29T18:00:00.000Z",
    }]);
    const repository = new PostgresPlatformOnboardingRepository(client);

    const snapshot = await loadPlatformOnboarding(repository, {
      account: { id: "acct_owner11", email: "owner11@example.com" },
    });

    expect(snapshot).toEqual({
      account: { id: "acct_owner11", email: "owner11@example.com" },
      leagues: [{
        leagueId: "league_1",
        leagueName: "Sunday Games",
        seasonId: "season_2026",
        seasonYear: 2026,
        membership: {
          role: "owner",
          ownerId: "owner11",
          teamId: "team_cam",
          ownerDisplayName: "Owner11",
          teamDisplayName: "Owner11's Team",
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
    expect(client.queries[0]?.params).toEqual(["acct_owner11"]);
    expect(client.queries[0]?.sql).toContain("lm.user_id = $1");
    expect(client.queries[0]?.sql).toContain("ft.owner_user_id = lm.user_id");
    expect(client.queries[0]?.sql).toContain("l.archived_at IS NULL");
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
      account: { id: "acct_owner04", email: "owner04@example.com" },
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
