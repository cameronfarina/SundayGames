import { describe, expect, it } from "vitest";
import {
  applyStrategyOverlay,
  createInMemoryPricingSnapshotRepository,
  createPricingSnapshot,
  generatePricingModelRunId,
  hashPricingSnapshotInputs,
  type PricingSourcePrice,
} from "../src/platform/pricingSnapshots.js";

const sourcePrices = [
  {
    name: "Bijan Robinson",
    normalizedName: "bijan robinson",
    position: "RB",
    price: 69,
    scenarioPrice: 74,
    livePrice: 77,
    personalValue: 82,
    recommendedMaxBid: 79,
    confidence: 0.91,
    tier: "elite",
    warnings: ["keeper inflation"],
  },
  {
    name: "Puka Nacua",
    normalizedName: "puka nacua",
    position: "WR",
    price: 68,
    scenarioPrice: 70,
    livePrice: 72,
    personalValue: 76,
    recommendedMaxBid: 73,
    confidence: 0.87,
    tier: "elite",
  },
] satisfies readonly PricingSourcePrice[];

describe("pricing snapshot contracts", () => {
  it("hashes normalized inputs stably regardless of object key insertion order", () => {
    const firstHash = hashPricingSnapshotInputs({
      modelVersion: "auction-v1",
      league: {
        season: 2026,
        settings: {
          teams: 14,
          budget: 200,
        },
      },
      scenario: {
        id: "expected",
        positionFactors: {
          RB: 1.07,
          WR: 1.04,
        },
      },
    });
    const secondHash = hashPricingSnapshotInputs({
      scenario: {
        positionFactors: {
          WR: 1.04,
          RB: 1.07,
        },
        id: "expected",
      },
      league: {
        settings: {
          budget: 200,
          teams: 14,
        },
        season: 2026,
      },
      modelVersion: "auction-v1",
    });

    expect(secondHash).toBe(firstHash);
  });

  it("generates the same model run id for the same league season model version and input hash", () => {
    const inputHash = hashPricingSnapshotInputs({ season: 2026, settings: { teams: 14 } });

    const firstId = generatePricingModelRunId({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      inputHash,
    });
    const secondId = generatePricingModelRunId({
      inputHash,
      modelVersion: "auction-v1",
      seasonYear: 2026,
      leagueId: "league-214674",
    });

    expect(secondId).toBe(firstId);
  });

  it("creates a snapshot that preserves distinct market scenario live personal and max prices", () => {
    const snapshot = createPricingSnapshot({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshot: {
        id: "input-snapshot-2026-expected",
        hash: hashPricingSnapshotInputs({ scenarioId: "expected" }),
      },
      prices: sourcePrices,
    });

    expect(snapshot.rows[0]).toMatchObject({
      playerName: "Bijan Robinson",
      normalizedName: "bijan robinson",
      position: "RB",
      marketPrice: 69,
      scenarioPrice: 74,
      livePrice: 77,
      personalValue: 82,
      recommendedMaxBid: 79,
      confidence: 0.91,
      tier: "elite",
      warnings: ["keeper inflation"],
    });
    expect(snapshot.rows[0]?.explanationRef).toEqual({
      modelRunId: snapshot.modelRunId,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshotId: "input-snapshot-2026-expected",
      playerKey: "bijan-robinson",
    });
  });

  it("refuses to overwrite an existing model run id with a different payload", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const snapshot = createPricingSnapshot({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshot: {
        id: "input-snapshot-2026-expected",
        hash: hashPricingSnapshotInputs({ scenarioId: "expected" }),
      },
      prices: sourcePrices,
    });
    const changedPayload = {
      ...snapshot,
      rows: snapshot.rows.map(row =>
        row.playerKey === "bijan-robinson"
          ? { ...row, livePrice: row.livePrice + 1 }
          : row,
      ),
    };

    repository.save(snapshot);
    repository.save(snapshot);

    expect(() => repository.save(changedPayload)).toThrow(
      "Cannot overwrite pricing snapshot",
    );
  });

  it("stores multiple scenario snapshots for the same model run", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const inputSnapshot = {
      id: "input-snapshot-2026",
      hash: hashPricingSnapshotInputs({ season: 2026 }),
    };
    const expectedSnapshot = createPricingSnapshot({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshot,
      prices: sourcePrices,
    });
    const highRetentionSnapshot = createPricingSnapshot({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "highRetention",
      inputSnapshot,
      prices: sourcePrices.map(price => ({
        ...price,
        scenarioPrice: price.scenarioPrice === undefined ? price.price + 2 : price.scenarioPrice + 2,
      })),
    });

    expect(highRetentionSnapshot.modelRunId).toBe(expectedSnapshot.modelRunId);

    repository.save(expectedSnapshot);
    repository.save(highRetentionSnapshot);

    expect(repository.get(expectedSnapshot.modelRunId, "expected")?.scenarioId).toBe("expected");
    expect(repository.get(expectedSnapshot.modelRunId, "highRetention")?.scenarioId).toBe("highRetention");
    expect(repository.list().map(snapshot => snapshot.scenarioId)).toEqual(["expected", "highRetention"]);
  });

  it("creates strategy overlays with derived personal values without mutating market prices", () => {
    const snapshot = createPricingSnapshot({
      leagueId: "league-214674",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshot: {
        id: "input-snapshot-2026-expected",
        hash: hashPricingSnapshotInputs({ scenarioId: "expected" }),
      },
      prices: sourcePrices,
    });

    const overlay = applyStrategyOverlay(snapshot, {
      strategyId: "three-rb",
      personalValueDeltas: {
        "bijan-robinson": 6,
        "puka-nacua": -4,
      },
      recommendedMaxBidDeltas: {
        "bijan-robinson": 3,
      },
    });

    expect(overlay.rows[0]).toMatchObject({
      marketPrice: 69,
      scenarioPrice: 74,
      livePrice: 77,
      personalValue: 88,
      recommendedMaxBid: 82,
      strategyOverlayId: "three-rb",
    });
    expect(overlay.rows[1]).toMatchObject({
      marketPrice: 68,
      scenarioPrice: 70,
      livePrice: 72,
      personalValue: 72,
      recommendedMaxBid: 73,
      strategyOverlayId: "three-rb",
    });
    expect(snapshot.rows[0]).toMatchObject({
      marketPrice: 69,
      personalValue: 82,
      recommendedMaxBid: 79,
    });
  });
});
