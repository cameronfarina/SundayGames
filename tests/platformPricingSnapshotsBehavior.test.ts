import { describe, expect, it } from "vitest";
import {
  applyStrategyOverlay,
  createInMemoryPricingSnapshotRepository,
  createPricingInputSnapshot,
  createPricingSnapshot,
  hashPricingSnapshotInputs,
  PricingSnapshotError,
  type PricingSourcePrice,
} from "../src/platform/pricingSnapshots.js";

const prices = [
  {
    name: "Amon-Ra St. Brown",
    normalizedName: "amon ra st brown",
    position: "WR",
    price: 61,
    liveExpectedPrice: 65,
  },
] satisfies readonly PricingSourcePrice[];

const buildSnapshot = (createdAt?: string) => createPricingSnapshot({
  leagueId: "Sunday Games",
  seasonYear: "2026",
  modelVersion: "Auction V2",
  scenarioId: "Expected",
  inputSnapshot: createPricingInputSnapshot({ teams: 14, budget: 200 }),
  prices,
  ...(createdAt === undefined ? {} : { createdAt }),
});

describe("pricing snapshot behavior", () => {
  it("canonicalizes dates, omitted object values, and sparse array values", () => {
    const first = hashPricingSnapshotInputs({
      capturedAt: new Date("2026-08-14T12:00:00.000Z"),
      omitted: undefined,
      values: [1, undefined, null],
    });
    const second = hashPricingSnapshotInputs({
      values: [1, null, null],
      capturedAt: "2026-08-14T12:00:00.000Z",
    });

    expect(first).toBe(second);
    expect(hashPricingSnapshotInputs(undefined)).toBe(hashPricingSnapshotInputs(null));
    expect(createPricingInputSnapshot({ ok: true }, "manual-id").id).toBe("manual-id");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects the non-finite input %s",
    value => {
      expect(() => hashPricingSnapshotInputs({ value })).toThrow(
        "Pricing snapshot inputs must contain only finite numbers.",
      );
    },
  );

  it("rejects class instances rather than hashing implementation details", () => {
    class UnsupportedInput {
      readonly value = 1;
    }

    expect(() => hashPricingSnapshotInputs(new UnsupportedInput())).toThrow(
      "Pricing snapshot inputs must be plain JSON-compatible values.",
    );
  });

  it("applies source fallbacks and normalized-name overlay deltas", () => {
    const snapshot = buildSnapshot();
    const overlaid = applyStrategyOverlay(snapshot, {
      strategyId: "balanced",
      personalValueDeltas: { "amon ra st brown": 2 },
      recommendedMaxBidDeltas: { "amon ra st brown": 3 },
    });

    expect(snapshot.rows[0]).toMatchObject({
      scenarioPrice: 61,
      livePrice: 65,
      personalValue: 65,
      recommendedMaxBid: 65,
    });
    expect(overlaid.rows[0]).toMatchObject({
      personalValue: 67,
      recommendedMaxBid: 68,
      strategyOverlayId: "balanced",
    });
  });

  it("defensively clones and freezes snapshots across every repository boundary", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const input = buildSnapshot();
    const saved = repository.save(input);

    expect(Object.isFrozen(saved)).toBe(true);
    expect(Object.isFrozen(saved.rows)).toBe(true);
    expect(Object.isFrozen(saved.rows[0])).toBe(true);
    expect(repository.get(saved.modelRunId, saved.scenarioId)).not.toBe(saved);
    expect(repository.get(saved.modelRunId)).toEqual(saved);
    expect(repository.list()[0]).not.toBe(saved);
    expect(repository.findLatest({
      leagueId: "another-league",
      seasonYear: 2026,
    })).toBeUndefined();
  });

  it("treats creation time as metadata but rejects semantic replacements", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const first = buildSnapshot("2026-08-14T12:00:00.000Z");
    repository.save(first);

    expect(repository.save(buildSnapshot("2026-08-14T13:00:00.000Z"))).toEqual(first);
    expect(() => repository.save({
      ...first,
      rows: first.rows.map(row => ({ ...row, marketPrice: row.marketPrice + 1 })),
    })).toThrow(PricingSnapshotError);
  });
});
