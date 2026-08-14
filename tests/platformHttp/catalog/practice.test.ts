import { InMemoryLiveDraftRoomSetupRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, canonicalPlayerIdentityKey, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, createPricingSnapshot, describe, espnPpr300AuctionBaseline2026Source, expect, hashPricingSnapshotInputs, it, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, snakePlayerCatalog, snakeSeason, vi } from "../support/index.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../support/index.js";

const wideReceiverPosition: LiveDraftRoomPlayerCatalogEntry["position"] = "WR";

describe("platform HTTP contract", () => {
it("serves the current player catalog to signed-in users without requiring a league", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const fallbackPlayer: LiveDraftRoomPlayerCatalogEntry = {
      name: "Unlisted Player",
      position: wideReceiverPosition,
      expectedPrice: 1,
    };
    const catalogWithFallback = [
      ...playerCatalog,
      fallbackPlayer,
    ];
    const currentPlayerCatalogProvider = vi.fn(async () => catalogWithFallback);
    const handle = createPlatformHttpHandler(app, { currentPlayerCatalogProvider });
    const login = await createLoggedInAccount(handle, "board-first@example.com");

    await expect(handle({ method: "GET", path: "/player-catalog" })).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      sessionToken: login.sessionToken,
    })).resolves.toEqual({
      status: 200,
      body: {
        baselinePricingSource: espnPpr300AuctionBaseline2026Source,
        pricingCoverage: {
          espnPlayerCount: 4,
          fallbackPlayerCount: 1,
          totalPlayerCount: 5,
        },
        players: [
          ...playerCatalog.map(player => ({
            ...player,
            baselineValueSource: "espn",
            marketValueSource: "espn",
          })),
          {
            ...fallbackPlayer,
            baselineValueSource: "mockd_projection",
            marketValueSource: "mockd_projection",
          },
        ],
      },
    });
    await expect(handle({
      method: "POST",
      path: "/player-catalog",
      sessionToken: login.sessionToken,
    })).resolves.toMatchObject({ status: 405 });
    expect(currentPlayerCatalogProvider).toHaveBeenCalledTimes(1);
  });

it("prices Practice from only the latest matching league snapshot", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => playerCatalog,
    });
    const owner11 = await createLoggedInAccount(handle, "latest-practice-pricing@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
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
    store.pricingSnapshots.save(createPricingSnapshot({
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "older-large-model",
      scenarioId: "expected",
      inputSnapshot: {
        id: "older-large-input",
        hash: hashPricingSnapshotInputs({ version: "older-large" }),
      },
      prices: Array.from({ length: 5_000 }, (_, index) => ({
        name: `Older Player ${index}`,
        normalizedName: `older player ${index}`,
        position: wideReceiverPosition,
        price: 1,
      })),
    }));
    const latest = store.pricingSnapshots.save(createPricingSnapshot({
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "latest-model",
      scenarioId: "expected",
      inputSnapshot: {
        id: "latest-input",
        hash: hashPricingSnapshotInputs({ version: "latest" }),
      },
      prices: playerCatalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.name === "Puka Nacua" ? 41 : player.expectedPrice,
      })),
    }));
    const legacyList = vi.spyOn(app, "listLeaguePricingSnapshots")
      .mockRejectedValue(new Error("Practice must not list every pricing snapshot."));

    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        personalized: true,
        pricingModelRunId: latest.modelRunId,
        players: expect.arrayContaining([
          expect.objectContaining({ name: "Puka Nacua", marketPrice: 41 }),
        ]),
      },
    });
    expect(legacyList).not.toHaveBeenCalled();
  });

it("marks snake keepers on the Practice catalog", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => snakePlayerCatalog,
      liveDraftRoomSetupRepository,
    });
    const owner11 = await createLoggedInAccount(handle, "snake-practice-keepers@example.com");
    const season = snakeSeason();
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
    await liveDraftRoomSetupRepository.save({
      seasonId: season.id,
      sourceVersion: "snake-keepers",
      playerCatalog: snakePlayerCatalog,
      initialRosters: [{
        teamId: season.teams[0]?.id ?? "snake-team-1",
        playerId: "player 1",
        playerName: "Player 1",
        position: "RB",
        price: 1,
        keeperRound: 1,
        source: "keeper",
      }],
      updatedAt: now,
    });

    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        draftFormat: "snake",
        players: expect.arrayContaining([
          expect.objectContaining({
            name: "Player 1",
            isKeeper: true,
            keeperRound: 1,
            keeperTeamId: season.teams[0]?.id,
          }),
        ]),
      },
    });
  });
});
