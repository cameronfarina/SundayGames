import { loadCurrentPlayerCatalog } from "../../../src/platform/localDemoFixtures.js";
import {
  InMemoryLiveDraftRoomSetupRepository,
  InMemoryPlatformStore,
  buildCurrentMockdLeagueSeason,
  canonicalPlayerIdentityKey,
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  createPricingSnapshot,
  describe,
  expect,
  expectBodyRecord,
  expectNumberRecord,
  hashPricingSnapshotInputs,
  it,
  leagueConfig,
  mockRunner,
  now,
  ownerOrder,
  vi,
} from "../support/index.js";

describe("platform HTTP pricing refresh", () => {
  it("refreshes legacy keeper pricing across Practice, mocks, and simulations", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const repository = new InMemoryLiveDraftRoomSetupRepository();
    const currentCatalog = await loadCurrentPlayerCatalog();
    const pollutedCatalog = currentCatalog.map(player => player.name === "Jahmyr Gibbs"
      ? { ...player, expectedPrice: 88, marketPrice: 88 }
      : player);
    let simulationExpectedPrices: Readonly<Record<string, number>> | undefined;
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => currentCatalog,
      liveDraftRoomSetupRepository: repository,
      seasonSimulationRunner: async input => {
        simulationExpectedPrices = input.playerExpectedPrices;
        return {
          draftFormat: "auction",
          runCount: input.runCount,
          completedCount: input.runCount,
          seedPrefix: input.seedPrefix ?? "legacy-pricing-refresh",
          strategy: {
            rawInput: input.strategyInput ?? "",
            preferredPositions: [],
            summary: "Balanced",
            warnings: [],
          },
          playerExposure: [],
          positionCounts: {},
          runs: [],
        };
      },
    });
    const login = await createLoggedInAccount(handle, "refresh-practice-pricing@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      setupStatus: "published",
    });
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: login.sessionToken,
      body: {
        season,
        memberships: [{
          userId: login.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    await repository.save({
      seasonId: season.id,
      sourceVersion: "legacy-pricing-refresh",
      playerCatalog: pollutedCatalog,
      initialRosters: [
        {
          teamId: season.teams[0]?.id ?? "keeper-team-1",
          playerName: "Jaxon Smith-Njigba",
          position: "WR",
          price: 1,
          source: "keeper",
        },
        {
          teamId: season.teams[1]?.id ?? "keeper-team-2",
          playerName: "De'Von Achane",
          position: "RB",
          price: 1,
          source: "keeper",
        },
      ],
      updatedAt: now,
    });
    const stale = store.pricingSnapshots.save(createPricingSnapshot({
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-history-keepers-v2",
      scenarioId: "expected",
      inputSnapshot: {
        id: "legacy-keeper-input",
        hash: hashPricingSnapshotInputs({ version: "legacy-keeper" }),
      },
      prices: pollutedCatalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.expectedPrice,
      })),
    }));
    const preflight = vi.spyOn(app, "preflightLeaguePricing");

    const response = await handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: login.sessionToken,
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        personalized: true,
        pricingModelRunId: expect.not.stringContaining(stale.modelRunId),
        players: expect.arrayContaining([
          expect.objectContaining({ name: "Jahmyr Gibbs", marketPrice: 57, myValue: 82 }),
        ]),
      },
    });
    expect(preflight).toHaveBeenCalledWith(expect.objectContaining({
      modelVersion: "league-history-keepers-v4",
    }));

    const mockResponse = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, strategy: "balanced" },
    });
    expect(mockResponse).toMatchObject({ status: 201 });
    const mockSession = expectBodyRecord(expectBodyRecord(mockResponse.body).mockSession);
    const mockSnapshot = expectBodyRecord(mockSession.configurationSnapshot);
    const mockPayload = expectBodyRecord(mockSnapshot.payload);
    expect(expectNumberRecord(mockPayload.playerExpectedPrices)[canonicalPlayerIdentityKey("Jahmyr Gibbs")])
      .toBe(82);

    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1 },
    })).resolves.toMatchObject({ status: 200 });
    expect(simulationExpectedPrices?.[canonicalPlayerIdentityKey("Jahmyr Gibbs")]).toBe(82);
  });
});
