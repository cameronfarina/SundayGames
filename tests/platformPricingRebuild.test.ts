import { describe, expect, it } from "vitest";
import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
import { slotPriceOwnerDisplayName } from "../src/platform/historicalImports/slotPriceProvenance.js";
import { loadCurrentPlayerCatalog } from "../src/platform/localDemoFixtures.js";
import { createLeagueCalibratedPricingSnapshots } from "../src/platform/pricingRebuild.js";
import { playerCatalogWithPricingSnapshot } from "../src/platform/http/routes/season/pricingOrchestration.js";
import type { HistoricalSaleRecord } from "../src/platform/historicalImports.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";

const baselinePrices = [
  {
    name: "Bijan Robinson",
    normalizedName: "bijan robinson",
    position: "RB",
    price: 50,
    confidence: 0.92,
    tier: "elite",
    warnings: ["baseline note"],
  },
] satisfies readonly PricingSourcePrice[];

const leagueBaselinePrices = [
  { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 80 },
  { name: "Bravo Runner", normalizedName: "bravo runner", position: "RB", price: 50 },
  { name: "Charlie Receiver", normalizedName: "charlie receiver", position: "WR", price: 25 },
  { name: "Delta Receiver", normalizedName: "delta receiver", position: "WR", price: 10 },
  { name: "Echo Tight End", normalizedName: "echo tight end", position: "TE", price: 5 },
  { name: "Foxtrot Kicker", normalizedName: "foxtrot kicker", position: "K", price: 4 },
  { name: "Golf Defense", normalizedName: "golf defense", position: "DST", price: 6 },
] satisfies readonly PricingSourcePrice[];

const historicalSale = (
  overrides: Partial<HistoricalSaleRecord> = {},
): HistoricalSaleRecord => ({
  id: "sale-2025-bijan",
  batchId: "batch-2025",
  leagueId: "league-100001",
  leagueSeasonId: "league-season-2025",
  seasonYear: 2025,
  rowNumber: 7,
  ownerId: "owner-owner11",
  ownerDisplayName: "Owner11",
  playerId: "player-bijan-robinson",
  playerName: "Bijan Robinson",
  position: "RB",
  priceDollars: 70,
  publicPriceDollars: 50,
  keeper: false,
  acquisitionType: "auction",
  ...overrides,
});

const historicalSaleWithoutPublicPrice = (
  overrides: Partial<HistoricalSaleRecord> = {},
): HistoricalSaleRecord => {
  const sale = historicalSale(overrides);
  delete sale.publicPriceDollars;

  return sale;
};

const leagueContext = {
  currentAuctionBudget: 200,
  currentTeamCount: 14,
  currentRosterSize: 16,
  currentMinimumBidDollars: 1,
};

describe("league-calibrated pricing rebuild", () => {
  it("scales every baseline price by one league inflation number", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
      createdAt: "2026-08-09T12:00:00.000Z",
    });

    expect(snapshot?.scenarioId).toBe("balanced");
    expect(snapshot?.createdAt).toBe("2026-08-09T12:00:00.000Z");
    expect(snapshot?.rows[0]).toMatchObject({
      playerName: "Bijan Robinson",
      normalizedName: "bijan robinson",
      position: "RB",
      marketPrice: 50,
      scenarioPrice: 70,
      livePrice: 70,
      personalValue: 70,
      recommendedMaxBid: 70,
      confidence: 0.92,
      tier: "elite",
    });
    expect(snapshot?.rows[0]?.warnings).toEqual([
      "baseline note",
      "this league pays 1.4x published market prices, from $70 paid against $50 published across 1 past auction sales",
    ]);
  });

  it("keeps keeper bargains out of every other player's price", () => {
    const priceFor = (currentKeepers: readonly { normalizedName: string; priceDollars: number }[]) =>
      createLeagueCalibratedPricingSnapshots({
        leagueId: "league-100001",
        seasonYear: 2026,
        modelVersion: "league-flat-inflation-v1",
        scenarioIds: ["expected"],
        baselinePrices: leagueBaselinePrices,
        historicalSaleRecords: [],
        ...leagueContext,
        currentKeepers,
        currentKeeperCount: currentKeepers.length,
        keeperLockedSpend: currentKeepers.reduce((total, keeper) => total + keeper.priceDollars, 0),
      })[0]?.rows.map(row => row.scenarioPrice);

    expect(priceFor([{ normalizedName: "alpha runner", priceDollars: 3 }]))
      .toEqual(priceFor([]));
    expect(priceFor([
      { normalizedName: "alpha runner", priceDollars: 3 },
      { normalizedName: "bravo runner", priceDollars: 2 },
    ])).toEqual(priceFor([]));
  });

  it("prices every kicker and defense at one dollar", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["expected"],
      baselinePrices: leagueBaselinePrices,
      historicalSaleRecords: [],
      ...leagueContext,
    });

    expect(snapshot?.rows.filter(row => row.position === "K" || row.position === "DST"))
      .toMatchObject([
        { playerName: "Foxtrot Kicker", marketPrice: 4, scenarioPrice: 2, personalValue: 2 },
        { playerName: "Golf Defense", marketPrice: 6, scenarioPrice: 2, personalValue: 2 },
      ]);
  });

  it("ignores what one player sold for in the past", () => {
    const scenarioPrices = (records: readonly HistoricalSaleRecord[]) =>
      createLeagueCalibratedPricingSnapshots({
        leagueId: "league-100001",
        seasonYear: 2026,
        modelVersion: "league-flat-inflation-v1",
        scenarioIds: ["expected"],
        baselinePrices: leagueBaselinePrices,
        historicalSaleRecords: records,
        ...leagueContext,
      })[0]?.rows.map(row => `${row.playerName} $${row.scenarioPrice}`);
    const spread = [
      historicalSale({ id: "a", playerName: "Alpha Runner", priceDollars: 40, publicPriceDollars: 40 }),
      historicalSale({ id: "b", playerName: "Bravo Runner", priceDollars: 60, publicPriceDollars: 60 }),
    ];
    const concentrated = [
      historicalSale({ id: "a", playerName: "Alpha Runner", priceDollars: 90, publicPriceDollars: 90 }),
      historicalSale({ id: "b", playerName: "Bravo Runner", priceDollars: 10, publicPriceDollars: 10 }),
    ];

    expect(scenarioPrices(spread)).toEqual(scenarioPrices(concentrated));
  });

  it("caps a player at one team's auction budget", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["expected"],
      baselinePrices: [
        { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 90 },
      ],
      historicalSaleRecords: [
        historicalSale({ id: "rich", priceDollars: 90, publicPriceDollars: 30 }),
      ],
      ...leagueContext,
      currentAuctionBudget: 100,
    });

    expect(snapshot?.rows[0]?.scenarioPrice).toBe(100);
  });

  it("falls back to league money over the published board without public values", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["balanced"],
      baselinePrices: leagueBaselinePrices,
      historicalSaleRecords: [historicalSaleWithoutPublicPrice()],
      ...leagueContext,
      currentTeamCount: 2,
      currentAuctionBudget: 100,
      currentRosterSize: 3,
    });

    expect(snapshot?.rows[0]).toMatchObject({ marketPrice: 80, scenarioPrice: 94 });
    expect(snapshot?.rows[0]?.warnings).toEqual([
      "league auction history unavailable; prices are scaled by league money alone",
      "this league pays 1.18x published market prices, from $200 of league money against a $170 published board",
    ]);
  });

  it("preserves baseline prices and metadata when nothing can set an inflation number", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({ leagueId: "another-league", priceDollars: 90 }),
        historicalSale({ id: "keeper-sale", keeper: true, acquisitionType: "keeper", priceDollars: 5 }),
      ],
    });

    expect(snapshot?.rows[0]).toMatchObject({
      marketPrice: 50,
      scenarioPrice: 50,
      livePrice: 50,
      personalValue: 50,
      recommendedMaxBid: 50,
      confidence: 0.92,
      tier: "elite",
      warnings: [
        "baseline note",
        "league inflation unavailable; using published market prices unchanged",
      ],
    });
  });

  it("creates deterministic snapshots for multiple scenarios", () => {
    const snapshotsFor = (scenarioIds: readonly string[]) =>
      createLeagueCalibratedPricingSnapshots({
        leagueId: "league-100001",
        seasonYear: 2026,
        modelVersion: "league-flat-inflation-v1",
        scenarioIds,
        baselinePrices,
        historicalSaleRecords: [historicalSale()],
      });
    const firstSnapshots = snapshotsFor(["balanced", "upside"]);
    const secondSnapshots = snapshotsFor(["balanced", "upside"]);
    const differentlyNamedScenario = snapshotsFor(["a label that must not move prices"])[0];

    expect(firstSnapshots.map(snapshot => snapshot.scenarioId)).toEqual(["balanced", "upside"]);
    expect(firstSnapshots[0]?.modelRunId).toBe(firstSnapshots[1]?.modelRunId);
    expect(firstSnapshots[0]?.rows[0]).toMatchObject({ marketPrice: 50, scenarioPrice: 70 });
    expect(firstSnapshots[1]?.rows[0]).toMatchObject({
      marketPrice: 50,
      scenarioPrice: 70,
      warnings: expect.arrayContaining([
        "scenario-specific assumptions unavailable; using the league-calibrated value",
      ]),
    });
    expect(differentlyNamedScenario?.modelRunId).toBe(firstSnapshots[0]?.modelRunId);
    expect(differentlyNamedScenario?.rows[0]?.scenarioPrice).toBe(70);
    expect(secondSnapshots).toEqual(firstSnapshots);
  });

  it("uses historical record identity and price in stable input hashes", () => {
    const snapshotFor = (
      historicalSaleRecords: readonly HistoricalSaleRecord[],
      extra: Record<string, unknown> = {},
    ) => createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords,
      ...extra,
    })[0];
    const older = historicalSale({ id: "sale-2024-bijan", seasonYear: 2024, priceDollars: 66 });
    const firstSnapshot = snapshotFor([older, historicalSale()]);

    expect(snapshotFor([historicalSale(), older])?.inputSnapshot)
      .toEqual(firstSnapshot?.inputSnapshot);
    expect(snapshotFor([historicalSale(), older])?.snapshotId).toBe(firstSnapshot?.snapshotId);
    expect(snapshotFor([{ ...older, priceDollars: 67 }, historicalSale()])?.inputSnapshot.hash)
      .not.toBe(firstSnapshot?.inputSnapshot.hash);
    expect(snapshotFor([{ ...older, id: "sale-2024-bijan-v2" }, historicalSale()])?.inputSnapshot.hash)
      .not.toBe(firstSnapshot?.inputSnapshot.hash);
    expect(snapshotFor([older, historicalSale()], {
      currentAuctionBudget: 200,
      currentTeamCount: 14,
      keeperLockedSpend: 120,
    })?.inputSnapshot.hash).not.toBe(firstSnapshot?.inputSnapshot.hash);
  });

  it("excludes records that cannot move the inflation number from input identity", () => {
    const snapshotFor = (historicalSaleRecords: readonly HistoricalSaleRecord[]) =>
      createLeagueCalibratedPricingSnapshots({
        leagueId: "league-100001",
        seasonYear: 2026,
        modelVersion: "league-flat-inflation-v1",
        scenarioIds: ["balanced"],
        baselinePrices,
        historicalSaleRecords,
      })[0];
    const trustedSnapshot = snapshotFor([historicalSale()]);
    const noisySnapshot = snapshotFor([
      historicalSale({ id: "future-sale", seasonYear: 2027, priceDollars: 100 }),
      historicalSale({ id: "other-league-sale", leagueId: "league-rival", priceDollars: 1 }),
      historicalSale({ id: "keeper-sale", keeper: true, acquisitionType: "keeper", priceDollars: 1 }),
      historicalSale({ id: "tiny-sale", priceDollars: 2, publicPriceDollars: 1 }),
      historicalSale({ id: "kicker-sale", position: "K", priceDollars: 6, publicPriceDollars: 1 }),
      historicalSale(),
    ]);

    expect(noisySnapshot?.rows[0]).toMatchObject({ marketPrice: 50, scenarioPrice: 70 });
    expect(noisySnapshot?.inputSnapshot).toEqual(trustedSnapshot?.inputSnapshot);
    expect(noisySnapshot?.snapshotId).toBe(trustedSnapshot?.snapshotId);
  });

  it("defaults to a balanced snapshot when no scenario ids are provided", () => {
    const snapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: [],
      baselinePrices,
      historicalSaleRecords: [],
    });

    expect(snapshots.map(snapshot => snapshot.scenarioId)).toEqual(["balanced"]);
    expect(snapshots[0]?.rows[0]).toMatchObject({ marketPrice: 50, scenarioPrice: 50 });
  });

  describe("slot price floors", () => {
    const slotFloorBaselinePrices = [
      { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 63 },
      { name: "Bravo Runner", normalizedName: "bravo runner", position: "RB", price: 61 },
      { name: "Charlie Receiver", normalizedName: "charlie receiver", position: "WR", price: 55 },
      { name: "Foxtrot Kicker", normalizedName: "foxtrot kicker", position: "K", price: 4 },
    ] satisfies readonly PricingSourcePrice[];

    const slotSale = (
      overrides: Partial<HistoricalSaleRecord> = {},
    ): HistoricalSaleRecord => historicalSale({
      id: `slot-${overrides.playerName ?? "RB1"}-${String(overrides.seasonYear ?? 2025)}`,
      ownerId: "owner-slot-prices",
      ownerDisplayName: slotPriceOwnerDisplayName,
      playerId: "player-slot",
      playerName: "RB1",
      ...overrides,
    });

    const slotSaleWithoutPublicPrice = (
      overrides: Partial<HistoricalSaleRecord> = {},
    ): HistoricalSaleRecord => {
      const sale = slotSale(overrides);
      delete sale.publicPriceDollars;

      return sale;
    };

    const snapshotFor = (
      historicalSaleRecords: readonly HistoricalSaleRecord[],
      extra: Record<string, unknown> = {},
    ) => createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v4",
      scenarioIds: ["expected"],
      baselinePrices: slotFloorBaselinePrices,
      historicalSaleRecords,
      ...extra,
    })[0];

    it("floors this year's top ranks at the league's slot prices", () => {
      const snapshot = snapshotFor([
        slotSale({ priceDollars: 77, publicPriceDollars: 70 }),
        slotSale({ playerName: "RB2", priceDollars: 68, publicPriceDollars: 66 }),
      ]);

      expect(snapshot?.rows.map(row => `${row.playerName} $${String(row.scenarioPrice)}`))
        .toEqual([
          "Alpha Runner $77",
          "Bravo Runner $68",
          "Charlie Receiver $59",
          "Foxtrot Kicker $2",
        ]);
      expect(snapshot?.rows[0]?.warnings).toContain(
        "imported slot prices set a floor for each position rank",
      );
    });

    it("keeps the inflated price when it clears the slot floor", () => {
      const snapshot = snapshotFor([
        slotSale({ priceDollars: 40, publicPriceDollars: 20 }),
      ]);

      expect(snapshot?.rows[0]).toMatchObject({
        playerName: "Alpha Runner",
        scenarioPrice: 126,
      });
    });

    it("averages a slot's price across seasons", () => {
      const snapshot = snapshotFor([
        slotSale({ seasonYear: 2024, priceDollars: 70, publicPriceDollars: 70 }),
        slotSale({ seasonYear: 2025, priceDollars: 80, publicPriceDollars: 70 }),
      ]);

      expect(snapshot?.rows[0]).toMatchObject({
        playerName: "Alpha Runner",
        scenarioPrice: 75,
      });
    });

    it("never floors kickers or defenses", () => {
      const snapshot = snapshotFor([
        slotSaleWithoutPublicPrice({ playerName: "K1", position: "K", priceDollars: 8 }),
      ]);

      expect(snapshot?.rows[3]).toMatchObject({
        playerName: "Foxtrot Kicker",
        scenarioPrice: 2,
      });
    });

    it("caps a slot floor at one team's auction budget", () => {
      const snapshot = snapshotFor(
        [slotSaleWithoutPublicPrice({ priceDollars: 150 })],
        { currentAuctionBudget: 100 },
      );

      expect(snapshot?.rows[0]).toMatchObject({
        playerName: "Alpha Runner",
        scenarioPrice: 100,
      });
    });

    it("ignores slot prices from a season that has not happened", () => {
      const snapshot = snapshotFor([
        slotSaleWithoutPublicPrice({ seasonYear: 2027, priceDollars: 90 }),
      ]);

      expect(snapshot?.rows[0]).toMatchObject({
        playerName: "Alpha Runner",
        scenarioPrice: 63,
      });
    });

    it("includes floor-only slot records in input identity", () => {
      const floored = snapshotFor([slotSaleWithoutPublicPrice({ priceDollars: 70 })]);
      const repriced = snapshotFor([slotSaleWithoutPublicPrice({ priceDollars: 71 })]);

      expect(floored?.rows[0]).toMatchObject({
        playerName: "Alpha Runner",
        scenarioPrice: 70,
      });
      expect(repriced?.inputSnapshot.hash).not.toBe(floored?.inputSnapshot.hash);
      expect(repriced?.snapshotId).not.toBe(floored?.snapshotId);
    });
  });

  it("separates Gibbs' $57 published price from his league simulation price", async () => {
    const catalog = await loadCurrentPlayerCatalog();
    const keepers = ["Jaxon Smith-Njigba", "De'Von Achane"].map(name => ({
      normalizedName: canonicalPlayerIdentityKey(name),
      priceDollars: 1,
    }));
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-flat-inflation-v1",
      scenarioIds: ["expected"],
      baselinePrices: catalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.marketPrice ?? player.expectedPrice,
      })),
      historicalSaleRecords: [],
      ...leagueContext,
      currentKeepers: keepers,
      currentKeeperCount: keepers.length,
      keeperLockedSpend: 2,
    });

    expect(catalog.find(player => player.name === "Jahmyr Gibbs")?.expectedPrice).toBe(57);
    expect(snapshot?.rows.find(row => row.playerName === "Jahmyr Gibbs")).toMatchObject({
      marketPrice: 57,
      scenarioPrice: 70,
      personalValue: 70,
      recommendedMaxBid: 70,
    });
    expect(playerCatalogWithPricingSnapshot(catalog, snapshot)
      .find(player => player.name === "Jahmyr Gibbs")).toMatchObject({
        expectedPrice: 70,
        marketPrice: 57,
      });
  });
});
