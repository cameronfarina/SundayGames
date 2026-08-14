import { describe, expect, it } from "vitest";
import { applyStrategyOverlay } from "../../src/platform/pricingSnapshots.js";
import { createExpectedSnapshot } from "./fixtures.js";

describe("pricing snapshot values", () => {
  it("creates a snapshot that preserves distinct market scenario live personal and max prices", () => {
    const snapshot = createExpectedSnapshot();
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

  it("creates strategy overlays with derived personal values without mutating market prices", () => {
    const snapshot = createExpectedSnapshot();
    const overlay = applyStrategyOverlay(snapshot, {
      strategyId: "three-rb",
      personalValueDeltas: { "bijan-robinson": 6, "puka-nacua": -4 },
      recommendedMaxBidDeltas: { "bijan-robinson": 3 },
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
