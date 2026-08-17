import { InMemoryLiveDraftRoomSetupRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, canonicalPlayerIdentityKey, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, leagueConfig, mockRunner, now, ownerOrder, playerCatalog } from "../support/index.js";
import { espnPpr300AuctionBaselineValueFor } from "../../../src/data/espnPpr300AuctionBaseline2026.js";

const publicPriceFor = (name: string, fallback: number): number =>
  Math.max(1, espnPpr300AuctionBaselineValueFor(name)?.auctionValue ?? fallback);

describe("platform HTTP contract", () => {
it("does not save a keeper when the resulting pricing snapshot would conflict", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupRepository,
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const owner11 = await createLoggedInAccount(handle, "keeper-conflict@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
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
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      },
    });
    const prepared = await app.preflightLeaguePricing({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-history-keepers-v4",
      scenarioIds: ["expected"],
      baselinePrices: playerCatalog.map(player => ({
          name: player.name,
          normalizedName: canonicalPlayerIdentityKey(player.name),
          position: player.position,
          price: publicPriceFor(player.name, player.expectedPrice),
        })),
      currentKeeperCount: 1,
      keeperLockedSpend: 50,
      currentKeepers: [{
        normalizedName: canonicalPlayerIdentityKey("De'Von Achane"),
        priceDollars: 50,
      }],
      now,
    });
    const snapshot = prepared.snapshots[0];
    if (snapshot === undefined) throw new Error("Expected prepared pricing snapshot.");
    store.pricingSnapshots.save({
      ...snapshot,
      rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, livePrice: row.livePrice + 1 } : row),
    });

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: owner11.sessionToken,
      body: { command: "owner11 keeping achane 50", confirmed: true },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "pricing_snapshot_conflict" } },
    });
    await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toBeNull();
  });

it("does not commit historical records when the resulting pricing snapshot would conflict", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const owner11 = await createLoggedInAccount(handle, "history-conflict@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
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
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      },
    });
    const preview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: owner11.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year\nOwner11,Puka Nacua,WR,70,2025",
        seasonYear: 2025,
      },
    });
    const batchId = expectString(expectBodyRecord(expectBodyRecord(preview.body).batch).id);
    const proposed = await app.prepareHistoricalImportCommit({
      actorSessionToken: owner11.sessionToken,
      batchId,
      expectedLeagueId: season.leagueId,
      expectedLeagueSeasonId: season.id,
      expectedSeasonYear: 2025,
      pricingSeasonYear: season.seasonYear,
      now,
    });
    const prepared = await app.preflightLeaguePricing({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-history-keepers-v4",
      scenarioIds: ["expected"],
      baselinePrices: playerCatalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: publicPriceFor(player.name, player.expectedPrice),
      })),
      historicalSaleRecords: proposed.projectedHistoricalSaleRecords,
      currentKeeperCount: 0,
      keeperLockedSpend: 0,
      currentKeepers: [],
      now,
    });
    const snapshot = prepared.snapshots[0];
    if (snapshot === undefined) throw new Error("Expected prepared pricing snapshot.");
    store.pricingSnapshots.save({
      ...snapshot,
      rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, livePrice: row.livePrice + 1 } : row),
    });

    await expect(handle({
      method: "POST",
      path: `/historical-imports/${batchId}/commit`,
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, seasonYear: 2025 },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "pricing_snapshot_conflict" } },
    });
    expect(store.historicalImports.findBatchById(batchId)).toMatchObject({ status: "previewed" });
    expect(store.historicalImports.currentRecords(season.leagueId, 2025)).toEqual([]);
  });
});
