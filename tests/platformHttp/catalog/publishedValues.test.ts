import { InMemoryLiveDraftRoomSetupRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, canonicalPlayerIdentityKey, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, leagueConfig, mockRunner, now, ownerOrder, playerCatalog } from "../support/index.js";
import type { LeagueSeason } from "../support/index.js";

describe("published season player values", () => {
  it("uses them before a pricing snapshot exists", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const setupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const currentCatalog = playerCatalog.map(player => player.name === "Jahmyr Gibbs"
      ? { ...player, expectedPrice: 55, marketPrice: 57 }
      : player);
    const publishedCatalog = currentCatalog.map(player => player.name === "Jahmyr Gibbs"
      ? { ...player, expectedPrice: 88 }
      : player);
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => currentCatalog,
      liveDraftRoomSetupRepository: setupRepository,
    });
    const owner = await createLoggedInAccount(handle, "published-practice-pricing@example.com");
    const baseSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const teams = baseSeason.teams.slice(0, 4);
    const season: LeagueSeason = {
      ...baseSeason,
      teams,
      settings: {
        ...baseSeason.settings,
        expectedTeamCount: teams.length,
        roster: {
          rosterSize: 1,
          lineup: { FLEX: 1 },
          lineupSlotCount: 1,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
        },
      },
    };
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: teams[0]?.ownerId,
          teamId: teams[0]?.id,
        }],
      },
    });
    await setupRepository.save({
      seasonId: season.id,
      sourceVersion: "published-season-values",
      playerCatalog: publishedCatalog,
      initialRosters: [],
      updatedAt: now,
    });

    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id, strategy: "balanced" },
      sessionToken: owner.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        personalized: true,
        players: expect.arrayContaining([
          expect.objectContaining({
            name: "Jahmyr Gibbs",
            marketPrice: 57,
            leagueValue: 88,
            myValue: 88,
          }),
        ]),
      },
    });
    const gibbsKey = canonicalPlayerIdentityKey("Jahmyr Gibbs");
    await expect(handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: owner.sessionToken,
      body: { seasonId: season.id, strategy: "balanced" },
    })).resolves.toMatchObject({
      status: 201,
      body: {
        mockSession: {
          configurationSnapshot: {
            payload: {
              playerExpectedPrices: { [gibbsKey]: 88 },
              playerHumanValues: { [gibbsKey]: 88 },
            },
          },
        },
      },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner.sessionToken,
      body: {},
    })).resolves.toMatchObject({
      status: 201,
      body: {
        room: {
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 88 }),
          ]),
        },
      },
    });
  });
});
