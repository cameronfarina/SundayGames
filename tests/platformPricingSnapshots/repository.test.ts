import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryPricingSnapshotRepository,
  createPricingSnapshot,
  hashPricingSnapshotInputs,
  type PricingSourcePrice,
} from "../../src/platform/pricingSnapshots.js";
import { createExpectedSnapshot, sourcePrices } from "./fixtures.js";

describe("pricing snapshot repository", () => {
  it("refuses to overwrite an existing model run id with a different payload", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const snapshot = createExpectedSnapshot();
    const changedPayload = {
      ...snapshot,
      rows: snapshot.rows.map(row => row.playerKey === "bijan-robinson"
        ? { ...row, livePrice: row.livePrice + 1 }
        : row),
    };
    repository.save(snapshot);
    repository.save(snapshot);
    expect(() => repository.save(changedPayload)).toThrow("Cannot overwrite pricing snapshot");
  });

  it("stores multiple scenario snapshots for the same model run", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const inputSnapshot = {
      id: "input-snapshot-2026",
      hash: hashPricingSnapshotInputs({ season: 2026 }),
    };
    const expectedSnapshot = createPricingSnapshot({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshot,
      prices: sourcePrices,
    });
    const highRetentionSnapshot = createPricingSnapshot({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "highRetention",
      inputSnapshot,
      prices: sourcePrices.map(price => ({
        ...price,
        scenarioPrice: price.scenarioPrice === undefined
          ? price.price + 2
          : price.scenarioPrice + 2,
      })),
    });
    expect(highRetentionSnapshot.modelRunId).toBe(expectedSnapshot.modelRunId);
    repository.save(expectedSnapshot);
    repository.save(highRetentionSnapshot);
    expect(repository.get(expectedSnapshot.modelRunId, "expected")?.scenarioId).toBe("expected");
    expect(repository.get(expectedSnapshot.modelRunId, "highRetention")?.scenarioId)
      .toBe("highRetention");
    expect(repository.list().map(snapshot => snapshot.scenarioId))
      .toEqual(["expected", "highRetention"]);
  });

  it("returns only the latest matching snapshot without cloning older large snapshots", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const olderPrices: readonly PricingSourcePrice[] = Array.from(
      { length: 5_000 },
      (_, index) => ({
        name: `Older Player ${index}`,
        normalizedName: `older player ${index}`,
        position: "WR",
        price: 1,
      }),
    );
    const olderSnapshot = createPricingSnapshot({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      scenarioId: "expected",
      inputSnapshot: {
        id: "input-snapshot-older",
        hash: hashPricingSnapshotInputs({ version: "older" }),
      },
      prices: olderPrices,
      createdAt: "2026-08-01T12:00:00.000Z",
    });
    const latestSnapshot = createPricingSnapshot({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "auction-v2",
      scenarioId: "expected",
      inputSnapshot: {
        id: "input-snapshot-latest",
        hash: hashPricingSnapshotInputs({ version: "latest" }),
      },
      prices: sourcePrices,
      createdAt: "2026-08-02T12:00:00.000Z",
    });
    repository.save(olderSnapshot);
    repository.save(latestSnapshot);
    const structuredCloneSpy = vi.spyOn(globalThis, "structuredClone");
    const result = repository.findLatest({
      leagueId: "league-100001",
      seasonYear: "2026",
      scenarioId: "expected",
    });
    expect(result).toEqual(latestSnapshot);
    expect(structuredCloneSpy).toHaveBeenCalledTimes(1);
    structuredCloneSpy.mockRestore();
  });
});
