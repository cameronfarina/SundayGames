import { describe, expect, it } from "vitest";
import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
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

const economicBaselinePrices = [
  { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 80 },
  { name: "Bravo Runner", normalizedName: "bravo runner", position: "RB", price: 50 },
  { name: "Charlie Receiver", normalizedName: "charlie receiver", position: "WR", price: 25 },
  { name: "Delta Receiver", normalizedName: "delta receiver", position: "WR", price: 10 },
  { name: "Echo Tight End", normalizedName: "echo tight end", position: "TE", price: 5 },
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

describe("league-calibrated pricing rebuild", () => {
  it("blends exact player historical sales into baseline prices", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
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
      scenarioPrice: 60,
      livePrice: 60,
      personalValue: 60,
      recommendedMaxBid: 60,
      confidence: 0.92,
      tier: "elite",
      warnings: [
        "baseline note",
        "league auction allocation unavailable; team count, budget, roster size, minimum bid, and keeper count were not fully provided",
        "league history moved price up by $10",
      ],
    });
  });

  it("normalizes position inflation against matching player anchors", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices: [
        {
          name: "Garrett Wilson",
          normalizedName: "garrett wilson",
          position: "WR",
          price: 40,
        },
        {
          name: "Puka Nacua",
          normalizedName: "puka nacua",
          position: "WR",
          price: 60,
        },
      ],
      historicalSaleRecords: [
        historicalSale({
          id: "sale-2025-puka",
          playerId: "player-puka-nacua",
          playerName: "Puka Nacua",
          position: "WR",
          priceDollars: 72,
          publicPriceDollars: 60,
        }),
      ],
    });

    const garrett = snapshot?.rows.find(row => row.playerName === "Garrett Wilson");

    expect(garrett).toMatchObject({
      playerName: "Garrett Wilson",
      position: "WR",
      marketPrice: 40,
      scenarioPrice: 44,
      warnings: expect.not.arrayContaining([
        "same-season public auction values unavailable; using baseline market prices",
      ]),
    });
  });

  it("applies historical sale-to-public ratios to the current player baseline", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices: [{
        name: "Bijan Robinson",
        normalizedName: "bijan robinson",
        position: "RB",
        price: 80,
      }],
      historicalSaleRecords: [historicalSale({
        priceDollars: 70,
        publicPriceDollars: 50,
      })],
    });

    expect(snapshot?.rows[0]).toMatchObject({ marketPrice: 80, scenarioPrice: 96 });
  });

  it("uses the raw league sale curve when same-season public values are absent", () => {
    const saleWithoutPublicValue = historicalSale();
    delete saleWithoutPublicValue.publicPriceDollars;
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [saleWithoutPublicValue],
    });

    expect(snapshot?.rows[0]).toMatchObject({
      marketPrice: 50,
      warnings: expect.arrayContaining([
        "same-season public auction values unavailable; calibrated from league sale-price curves",
      ]),
    });
  });

  it("calibrates simulation prices from league sale curves when public values are absent", () => {
    const sales = [
      historicalSaleWithoutPublicPrice({
        id: "sale-2024-alpha",
        seasonYear: 2024,
        playerId: "player-alpha-runner",
        playerName: "Alpha Runner",
        priceDollars: 70,
      }),
      historicalSaleWithoutPublicPrice({
        id: "sale-2024-bravo",
        seasonYear: 2024,
        playerId: "player-bravo-runner",
        playerName: "Bravo Runner",
        priceDollars: 40,
      }),
      historicalSaleWithoutPublicPrice({
        id: "sale-2025-charlie",
        seasonYear: 2025,
        playerId: "player-charlie-runner",
        playerName: "Charlie Runner",
        priceDollars: 76,
      }),
      historicalSaleWithoutPublicPrice({
        id: "sale-2025-delta",
        seasonYear: 2025,
        playerId: "player-delta-runner",
        playerName: "Delta Runner",
        priceDollars: 45,
      }),
    ];
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices: [
        { name: "Current RB One", normalizedName: "current rb one", position: "RB", price: 80 },
        { name: "Current RB Two", normalizedName: "current rb two", position: "RB", price: 50 },
      ],
      historicalSaleRecords: sales,
    });

    expect(snapshot?.rows).toEqual([
      expect.objectContaining({
        playerName: "Current RB One",
        marketPrice: 80,
        scenarioPrice: 77,
        warnings: expect.arrayContaining([
          "same-season public auction values unavailable; calibrated from league sale-price curves",
        ]),
      }),
      expect.objectContaining({
        playerName: "Current RB Two",
        marketPrice: 50,
        scenarioPrice: 46,
      }),
    ]);
  });

  it("weights sparse public values by their position coverage instead of replacing the sale curve", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v2",
      scenarioIds: ["balanced"],
      baselinePrices: [
        { name: "Current WR One", normalizedName: "current wr one", position: "WR", price: 60 },
        { name: "Current WR Two", normalizedName: "current wr two", position: "WR", price: 20 },
      ],
      historicalSaleRecords: [
        historicalSale({
          id: "sale-public-top-wr",
          playerId: "player-public-top-wr",
          playerName: "Public Top WR",
          position: "WR",
          priceDollars: 70,
          publicPriceDollars: 60,
        }),
        historicalSaleWithoutPublicPrice({
          id: "sale-curve-second-wr",
          playerId: "player-curve-second-wr",
          playerName: "Curve Second WR",
          position: "WR",
          priceDollars: 30,
        }),
        historicalSaleWithoutPublicPrice({
          id: "sale-curve-third-wr",
          playerId: "player-curve-third-wr",
          playerName: "Curve Third WR",
          position: "WR",
          priceDollars: 10,
        }),
      ],
    });

    expect(snapshot?.rows).toEqual([
      expect.objectContaining({ playerName: "Current WR One", marketPrice: 60, scenarioPrice: 65 }),
      expect.objectContaining({ playerName: "Current WR Two", marketPrice: 20, scenarioPrice: 24 }),
    ]);
  });

  it("creates deterministic snapshots for multiple scenarios", () => {
    const firstSnapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced", "upside"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    });
    const secondSnapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced", "upside"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    });
    const differentlyNamedScenario = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["a label that must not move prices"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    })[0];

    expect(firstSnapshots.map(snapshot => snapshot.scenarioId)).toEqual(["balanced", "upside"]);
    expect(firstSnapshots[0]?.modelRunId).toBe(firstSnapshots[1]?.modelRunId);
    expect(firstSnapshots[0]?.rows[0]).toMatchObject({
      marketPrice: 50,
      scenarioPrice: 60,
    });
    expect(firstSnapshots[1]?.rows[0]).toMatchObject({
      marketPrice: 50,
      scenarioPrice: 60,
      warnings: expect.arrayContaining([
        "scenario-specific assumptions unavailable; using the league-calibrated value",
      ]),
    });
    expect(differentlyNamedScenario?.modelRunId).toBe(firstSnapshots[0]?.modelRunId);
    expect(differentlyNamedScenario?.rows[0]?.scenarioPrice).toBe(60);
    expect(secondSnapshots).toEqual(firstSnapshots);
  });

  it("allocates current league dollars after keeper spend and minimum-bid reserves", () => {
    const createSnapshot = (
      keeperLockedSpend: number,
      currentMinimumBidDollars: number,
      currentTeamCount = 2,
    ) => createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["expected"],
      baselinePrices: economicBaselinePrices,
      historicalSaleRecords: [],
      currentAuctionBudget: 100,
      currentTeamCount,
      currentRosterSize: 2,
      currentMinimumBidDollars,
      currentKeeperCount: 1,
      keeperLockedSpend,
    })[0];

    const cheapKeeper = createSnapshot(10, 1);
    const expensiveKeeper = createSnapshot(50, 1);
    const higherMinimumBid = createSnapshot(10, 10);
    const largerLeague = createSnapshot(10, 1, 3);
    const scenarioTotal = (snapshot: NonNullable<typeof cheapKeeper>) =>
      snapshot.rows.reduce((total, row) => total + row.scenarioPrice, 0);
    const discretionaryTotal = (
      snapshot: NonNullable<typeof cheapKeeper>,
      minimumBid: number,
    ) => snapshot.rows.reduce(
      (total, row) => total + (row.scenarioPrice === 0 ? 0 : row.scenarioPrice - minimumBid),
      0,
    );

    expect(scenarioTotal(cheapKeeper!)).toBe(190);
    expect(scenarioTotal(expensiveKeeper!)).toBe(150);
    expect(scenarioTotal(largerLeague!)).toBe(290);
    expect(discretionaryTotal(cheapKeeper!, 1)).toBe(187);
    expect(discretionaryTotal(higherMinimumBid!, 10)).toBe(160);
    expect(cheapKeeper?.rows.every(row => Number.isInteger(row.scenarioPrice))).toBe(true);
    expect(cheapKeeper?.rows.every(row => row.scenarioPrice >= 0 && row.scenarioPrice <= 100)).toBe(true);
  });

  it("applies public-market keeper savings at the full-pool inflation rate", () => {
    const baseInput = {
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v2",
      scenarioIds: ["expected"],
      baselinePrices: economicBaselinePrices,
      historicalSaleRecords: [],
      currentAuctionBudget: 100,
      currentTeamCount: 2,
      currentRosterSize: 2,
      currentMinimumBidDollars: 1,
    };
    const baseline = createLeagueCalibratedPricingSnapshots({
      ...baseInput,
      currentKeeperCount: 0,
      keeperLockedSpend: 0,
    })[0];
    const keeperAdjusted = createLeagueCalibratedPricingSnapshots({
      ...baseInput,
      currentKeeperCount: 1,
      keeperLockedSpend: 5,
      currentKeepers: [{ normalizedName: "delta receiver", priceDollars: 5 }],
    } as typeof baseInput & {
      currentKeeperCount: number;
      keeperLockedSpend: number;
      currentKeepers: readonly { normalizedName: string; priceDollars: number }[];
    })[0];
    const availableNames = new Set(economicBaselinePrices
      .map(player => player.name)
      .filter(name => name !== "Delta Receiver"));
    const totalFor = (rows: NonNullable<typeof baseline>["rows"]) => rows
      .filter(row => availableNames.has(row.playerName))
      .reduce((total, row) => total + row.scenarioPrice, 0);

    const availableIncrease = totalFor(keeperAdjusted?.rows ?? []) - totalFor(baseline?.rows ?? []);
    expect(availableIncrease).toBe(3);
    expect(keeperAdjusted?.rows.find(row => row.playerName === "Delta Receiver")?.scenarioPrice).toBe(10);
    expect(keeperAdjusted?.rows[0]?.scenarioPrice).toBe((baseline?.rows[0]?.scenarioPrice ?? 0) + 2);
  });

  it("does not count league-history inflation as keeper savings a second time", () => {
    const input = {
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v2",
      scenarioIds: ["expected"],
      baselinePrices: economicBaselinePrices,
      historicalSaleRecords: [historicalSale({
        id: "sale-2025-delta",
        playerId: "player-delta-receiver",
        playerName: "Delta Receiver",
        position: "WR",
        priceDollars: 20,
        publicPriceDollars: 10,
      })],
      currentAuctionBudget: 100,
      currentTeamCount: 2,
      currentRosterSize: 2,
      currentMinimumBidDollars: 1,
      currentKeeperCount: 1,
      keeperLockedSpend: 5,
    };
    const withoutKeeperSavings = createLeagueCalibratedPricingSnapshots({
      ...input,
      currentKeepers: [],
    })[0];
    const withKeeperSavings = createLeagueCalibratedPricingSnapshots({
      ...input,
      currentKeepers: [{ normalizedName: "delta receiver", priceDollars: 5 }],
    })[0];
    const alphaBefore = withoutKeeperSavings?.rows.find(row => row.playerName === "Alpha Runner");
    const alphaAfter = withKeeperSavings?.rows.find(row => row.playerName === "Alpha Runner");

    expect(alphaAfter?.scenarioPrice).toBe((alphaBefore?.scenarioPrice ?? 0) + 2);
    expect(alphaAfter?.warnings).toContain(
      "available player values include $5 in public-market keeper savings at the full-pool rate",
    );
  });

  it("normalizes league-history simulation prices to the current league budget", () => {
    const deflatedCurveSales = [
      historicalSaleWithoutPublicPrice({
        id: "sale-2025-rb-one", playerId: "player-past-rb-one", playerName: "Past RB One",
        position: "RB", priceDollars: 20,
      }),
      historicalSaleWithoutPublicPrice({
        id: "sale-2024-rb-two", playerId: "player-past-rb-two", playerName: "Past RB Two",
        position: "RB", priceDollars: 12, seasonYear: 2024,
      }),
      historicalSaleWithoutPublicPrice({
        id: "sale-2025-wr-one", playerId: "player-past-wr-one", playerName: "Past WR One",
        position: "WR", priceDollars: 6,
      }),
      historicalSaleWithoutPublicPrice({
        id: "sale-2025-te-one", playerId: "player-past-te-one", playerName: "Past TE One",
        position: "TE", priceDollars: 1,
      }),
    ];
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v2",
      scenarioIds: ["expected"],
      baselinePrices: economicBaselinePrices,
      historicalSaleRecords: deflatedCurveSales,
      currentAuctionBudget: 100,
      currentTeamCount: 2,
      currentRosterSize: 2,
      currentMinimumBidDollars: 1,
      currentKeeperCount: 1,
      keeperLockedSpend: 5,
      currentKeepers: [{ normalizedName: "delta receiver", priceDollars: 5 }],
    });

    const availableTotal = snapshot?.rows
      .filter(row => row.playerName !== "Delta Receiver")
      .reduce((total, row) => total + row.scenarioPrice, 0) ?? 0;

    expect(availableTotal).toBeGreaterThan(150);
    expect(availableTotal).toBeLessThanOrEqual(200);
  });

  it("caps keeper-inflated player values at one team's auction budget", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v2",
      scenarioIds: ["expected"],
      baselinePrices: economicBaselinePrices,
      historicalSaleRecords: [],
      currentAuctionBudget: 100,
      currentTeamCount: 2,
      currentRosterSize: 2,
      currentMinimumBidDollars: 1,
      currentKeeperCount: 1,
      keeperLockedSpend: 1,
      currentKeepers: [{ normalizedName: "delta receiver", priceDollars: 1 }],
    });

    expect(Math.max(...(snapshot?.rows.map(row => row.scenarioPrice) ?? []))).toBe(100);
  });

  it("separates Gibbs' $57 market price from his $99 budget-scaled simulation price", async () => {
    const catalog = await loadCurrentPlayerCatalog();
    const keepers = ["Jaxon Smith-Njigba", "De'Von Achane"].map(normalizedName => ({
      normalizedName: canonicalPlayerIdentityKey(normalizedName),
      priceDollars: 1,
    }));
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v2",
      scenarioIds: ["expected"],
      baselinePrices: catalog.map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.marketPrice ?? player.expectedPrice,
      })),
      historicalSaleRecords: [historicalSaleWithoutPublicPrice({
        id: "sale-2024-gibbs",
        seasonYear: 2024,
        playerId: "player-jahmyr-gibbs",
        playerName: "Jahmyr Gibbs",
        position: "RB",
        priceDollars: 81,
      })],
      currentAuctionBudget: 200,
      currentTeamCount: 14,
      currentRosterSize: 16,
      currentMinimumBidDollars: 1,
      currentKeeperCount: keepers.length,
      keeperLockedSpend: 2,
      currentKeepers: keepers,
    });

    expect(catalog.find(player => player.name === "Jahmyr Gibbs")?.expectedPrice).toBe(57);
    expect(snapshot?.rows.find(row => row.playerName === "Jahmyr Gibbs")).toMatchObject({
      marketPrice: 57,
      scenarioPrice: 99,
      personalValue: 99,
      recommendedMaxBid: 99,
    });
    expect(playerCatalogWithPricingSnapshot(catalog, snapshot)
      .find(player => player.name === "Jahmyr Gibbs")).toMatchObject({
        expectedPrice: 99,
        marketPrice: 57,
      });
  });

  it("uses historical record identity and price in stable input hashes", () => {
    const firstSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({ id: "sale-2024-bijan", seasonYear: 2024, priceDollars: 66 }),
        historicalSale(),
      ],
    })[0];
    const reorderedSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale(),
        historicalSale({ id: "sale-2024-bijan", seasonYear: 2024, priceDollars: 66 }),
      ],
    })[0];
    const repricedSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({ id: "sale-2024-bijan", seasonYear: 2024, priceDollars: 67 }),
        historicalSale(),
      ],
    })[0];
    const reidentifiedSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({ id: "sale-2024-bijan-v2", seasonYear: 2024, priceDollars: 66 }),
        historicalSale(),
      ],
    })[0];
    const budgetContextSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({ id: "sale-2024-bijan", seasonYear: 2024, priceDollars: 66 }),
        historicalSale(),
      ],
      currentAuctionBudget: 200,
      currentTeamCount: 14,
      keeperLockedSpend: 120,
    })[0];

    expect(reorderedSnapshot?.inputSnapshot).toEqual(firstSnapshot?.inputSnapshot);
    expect(reorderedSnapshot?.snapshotId).toBe(firstSnapshot?.snapshotId);
    expect(repricedSnapshot?.inputSnapshot.hash).not.toBe(firstSnapshot?.inputSnapshot.hash);
    expect(reidentifiedSnapshot?.inputSnapshot.hash).not.toBe(firstSnapshot?.inputSnapshot.hash);
    expect(budgetContextSnapshot?.inputSnapshot.hash).not.toBe(firstSnapshot?.inputSnapshot.hash);
  });

  it("preserves baseline prices and metadata when there is no usable history", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({
          leagueId: "another-league",
          priceDollars: 90,
        }),
        historicalSale({
          id: "keeper-sale",
          keeper: true,
          acquisitionType: "keeper",
          priceDollars: 5,
        }),
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
        "league auction history unavailable; using baseline market prices",
        "league auction allocation unavailable; team count, budget, roster size, minimum bid, and keeper count were not fully provided",
      ],
    });
  });

  it("excludes unused and future historical records from calibration input identity", () => {
    const trustedSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    })[0];
    const noisySnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [
        historicalSale({
          id: "future-sale",
          seasonYear: 2027,
          priceDollars: 100,
        }),
        historicalSale({
          id: "other-league-sale",
          leagueId: "league-rival",
          priceDollars: 1,
        }),
        historicalSale({
          id: "keeper-sale",
          keeper: true,
          acquisitionType: "keeper",
          priceDollars: 1,
        }),
        historicalSale(),
      ],
    })[0];

    expect(noisySnapshot?.rows[0]).toMatchObject({
      marketPrice: 50,
      scenarioPrice: 60,
    });
    expect(noisySnapshot?.inputSnapshot).toEqual(trustedSnapshot?.inputSnapshot);
    expect(noisySnapshot?.snapshotId).toBe(trustedSnapshot?.snapshotId);
  });

  it("defaults to a balanced snapshot when no scenario ids are provided", () => {
    const snapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: [],
      baselinePrices,
      historicalSaleRecords: [],
    });

    expect(snapshots.map(snapshot => snapshot.scenarioId)).toEqual(["balanced"]);
    expect(snapshots[0]?.rows[0]).toMatchObject({
      marketPrice: 50,
      scenarioPrice: 50,
    });
  });
});
