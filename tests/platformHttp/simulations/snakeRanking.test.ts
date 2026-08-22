import {
  InMemoryLiveDraftRoomSetupRepository,
  InMemoryPlatformStore,
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  expectBodyRecord,
  mockRunner,
  now,
  snakePlayerCatalog,
  snakeSeason,
  it,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../support/index.js";

describe("snake simulation ranking", () => {
  it("uses the current board rank order instead of the stored setup order", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const setupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const rankedPlayers: readonly LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
      { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 57 },
      ...snakePlayerCatalog.slice(2),
    ];
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => rankedPlayers,
      liveDraftRoomSetupRepository: setupRepository,
    });
    const account = await createLoggedInAccount(handle, "snake-rank@example.com");
    const season = snakeSeason();
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: account.sessionToken,
      body: {
        season,
        memberships: [{
          userId: account.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    await setupRepository.save({
      seasonId: season.id,
      sourceVersion: "stored-snake-order",
      playerCatalog: rankedPlayers,
      initialRosters: [],
      updatedAt: now,
    });

    const response = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: account.sessionToken,
      now,
      body: { seasonId: season.id, count: 1, requestId: "current-rank-order" },
    });

    expect(response.status).toBe(202);
    const input = expectBodyRecord(expectBodyRecord(response.body).input);
    const catalog = expectBodyRecord(input.setup).playerCatalog;
    expect(Array.isArray(catalog)).toBe(true);
    expect(Array.isArray(catalog) ? catalog.slice(0, 2) : []).toMatchObject([
      { name: "Jahmyr Gibbs" },
      { name: "De'Von Achane" },
    ]);
  });
});
