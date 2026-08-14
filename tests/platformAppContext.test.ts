import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { createPlatformAppContext, canMutateLeague } from "../src/platform/app/context.js";
import { InMemoryPlatformStore } from "../src/platform/app/store/InMemoryPlatformStore.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { PlatformLeagueMembership } from "../src/platform/leagueSetup.js";
import { contextTestRunner } from "./platformAppContextFixtures.js";

describe("platform app context", () => {
  it("uses the supplied store by default and preserves access error contracts", async () => {
    const store = new InMemoryPlatformStore();
    const context = createPlatformAppContext({ store, simulationRunner: contextTestRunner });

    expect(context.store).toBe(store);
    expect(context.leagueSetup).toBe(store);
    expect(context.usesExternalLeagueSetup).toBe(false);
    await expect(context.requireAccount("missing-session")).rejects.toMatchObject({
      code: "auth_required",
      message: "Sign in before using this workspace.",
    });
    await expect(context.requireSeason("missing-season")).rejects.toMatchObject({
      code: "season_not_found",
      message: "League season was not found.",
    });
    expect(canMutateLeague("owner")).toBe(true);
    expect(canMutateLeague("admin")).toBe(true);
    expect(canMutateLeague("member")).toBe(false);
  });

  it("mirrors externally persisted seasons and memberships into its operational store", async () => {
    const store = new InMemoryPlatformStore();
    const externalLeagueSetup = new InMemoryPlatformStore();
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "External league",
      setupStatus: "published",
    });
    const membership: PlatformLeagueMembership = {
      userId: "account-external-owner",
      leagueId: season.leagueId,
      role: "owner",
    };
    externalLeagueSetup.registerLeagueSeason({
      season,
      memberships: [membership],
      createdByUserId: membership.userId,
    });
    const context = createPlatformAppContext({
      store,
      leagueSetupRepository: externalLeagueSetup,
      simulationRunner: contextTestRunner,
    });

    expect(context.usesExternalLeagueSetup).toBe(true);
    await expect(context.requireSeason(season.id)).resolves.toEqual(season);
    expect(store.findLeagueSeason(season.id)).toEqual(season);
    expect(store.findMembership(membership.userId, membership.leagueId)).toEqual(membership);
  });
});
