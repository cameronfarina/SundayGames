import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, leagueConfig, mockRunner, ownerOrder, playerCatalog } from "../support/index.js";

describe("platform HTTP contract", () => {
it("persists a Practice shortlist privately for each league member", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const owner11 = await createLoggedInAccount(handle, "practice-shortlist@example.com");
    const outsider = await createLoggedInAccount(handle, "practice-shortlist-outsider@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    await expect(handle({
      method: "GET",
      path: "/practice-shortlist",
      query: { seasonId: season.id },
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: outsider.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua", position: "WR" },
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "membership_required" } } });
    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua", maxBid: 0 },
    })).resolves.toMatchObject({ status: 400, body: { error: { code: "invalid_max_bid" } } });
    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, playerName: "puka nacua", position: "WR" },
    })).resolves.toMatchObject({
      status: 200,
      body: { item: { playerName: "Puka Nacua", position: "WR", userId: owner11.account.id } },
    });
    await expect(handle({
      method: "GET",
      path: "/practice-shortlist",
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: { items: [{ playerName: "Puka Nacua", position: "WR" }] },
    });
    expect(store.snapshot().practiceShortlistItems).toHaveLength(1);
    await expect(handle({
      method: "DELETE",
      path: "/practice-shortlist",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua" },
    })).resolves.toMatchObject({ status: 200, body: { removed: true } });
    expect(store.snapshot().practiceShortlistItems).toHaveLength(0);
  });
});
