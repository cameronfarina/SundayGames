import { describe, expect, it } from "vitest";
import { createLeagueCalibratedPricingSnapshots } from "../src/platform/pricingRebuild.js";
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

const historicalSale = (
  overrides: Partial<HistoricalSaleRecord> = {},
): HistoricalSaleRecord => ({
  id: "sale-2025-bijan",
  batchId: "batch-2025",
  leagueId: "league-214674",
  leagueSeasonId: "league-season-2025",
  seasonYear: 2025,
  rowNumber: 7,
  ownerId: "owner-cam",
  ownerDisplayName: "Cam",
  playerId: "player-bijan-robinson",
  playerName: "Bijan Robinson",
  position: "RB",
  priceDollars: 70,
  keeper: false,
  acquisitionType: "auction",
  ...overrides,
});

describe("league-calibrated pricing rebuild", () => {
  it("blends exact player historical sales into baseline prices", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
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
      marketPrice: 60,
      scenarioPrice: 60,
      livePrice: 60,
      personalValue: 60,
      recommendedMaxBid: 60,
      confidence: 0.92,
      tier: "elite",
      warnings: ["baseline note", "historical inflation moved price by $10"],
    });
  });

  it("falls back to position-level historical inflation when a player has no matching sale", () => {
    const [snapshot] = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
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
      ],
      historicalSaleRecords: [
        historicalSale({
          id: "sale-2025-puka",
          playerId: "player-puka-nacua",
          playerName: "Puka Nacua",
          position: "WR",
          priceDollars: 60,
        }),
      ],
    });

    expect(snapshot?.rows[0]).toMatchObject({
      playerName: "Garrett Wilson",
      position: "WR",
      marketPrice: 50,
      scenarioPrice: 50,
      warnings: ["historical inflation moved price by $10"],
    });
  });

  it("creates deterministic snapshots for multiple scenarios", () => {
    const firstSnapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced", "upside"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    });
    const secondSnapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced", "upside"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    });

    expect(firstSnapshots.map(snapshot => snapshot.scenarioId)).toEqual(["balanced", "upside"]);
    expect(firstSnapshots[0]?.modelRunId).toBe(firstSnapshots[1]?.modelRunId);
    expect(firstSnapshots[0]?.rows[0]).toMatchObject({
      marketPrice: 60,
      scenarioPrice: 60,
    });
    expect(firstSnapshots[1]?.rows[0]).toMatchObject({
      marketPrice: 60,
      scenarioPrice: 63,
    });
    expect(secondSnapshots).toEqual(firstSnapshots);
  });

  it("uses historical record identity and price in stable input hashes", () => {
    const firstSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
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
      leagueId: "league-214674",
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
      leagueId: "league-214674",
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
      leagueId: "league-214674",
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
      leagueId: "league-214674",
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
      leagueId: "league-214674",
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
      warnings: ["baseline note"],
    });
  });

  it("excludes unused and future historical records from calibration input identity", () => {
    const trustedSnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      historicalSaleRecords: [historicalSale()],
    })[0];
    const noisySnapshot = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
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
      marketPrice: 60,
      scenarioPrice: 60,
    });
    expect(noisySnapshot?.inputSnapshot).toEqual(trustedSnapshot?.inputSnapshot);
    expect(noisySnapshot?.snapshotId).toBe(trustedSnapshot?.snapshotId);
  });

  it("defaults to a balanced snapshot when no scenario ids are provided", () => {
    const snapshots = createLeagueCalibratedPricingSnapshots({
      leagueId: "league-214674",
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
