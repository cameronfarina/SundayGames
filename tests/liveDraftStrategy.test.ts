import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildLiveDraftState } from "../src/modeling/liveDraft.js";
import { liveDraftStrategies } from "../src/modeling/liveDraftStrategies.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("live draft strategy values", () => {
  it("changes Owner11's personal value and tags without changing market anchors", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const balanced = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      strategyKey: "balanced",
    });
    const threeRb = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      strategyKey: "three-rb",
    });
    const wrHeavy = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      strategyKey: "wr-heavy",
    });

    const balancedGibbs = balanced.availableTargets.find(target => target.name === "Jahmyr Gibbs");
    const threeRbGibbs = threeRb.availableTargets.find(target => target.name === "Jahmyr Gibbs");
    const balancedWalker = balanced.availableTargets.find(target => target.name === "Kenneth Walker III");
    const threeRbWalker = threeRb.availableTargets.find(target => target.name === "Kenneth Walker III");
    const balancedLondon = balanced.availableTargets.find(target => target.name === "Drake London");
    const wrHeavyLondon = wrHeavy.availableTargets.find(target => target.name === "Drake London");

    expect(Object.keys(liveDraftStrategies)).toEqual(["balanced", "three-rb", "hero-rb", "wr-heavy"]);
    expect(balanced.strategy.key).toBe("balanced");
    expect(threeRb.strategy.key).toBe("three-rb");
    expect(balancedGibbs?.liveExpectedPrice).toBe(threeRbGibbs?.liveExpectedPrice);
    expect(balancedWalker?.liveExpectedPrice).toBe(threeRbWalker?.liveExpectedPrice);
    expect(threeRbWalker?.personalValue).toBeGreaterThan(balancedWalker?.personalValue ?? 0);
    expect(threeRbGibbs?.tags).toContain("3RB core");
    expect(balancedGibbs?.tags).not.toContain("3RB core");
    expect(wrHeavyLondon?.liveExpectedPrice).toBe(balancedLondon?.liveExpectedPrice);
    expect(wrHeavyLondon?.personalValue).toBeGreaterThan(balancedLondon?.personalValue ?? 0);
  });

  it("keeps Owner11's uncapped strategy value separate from path max discipline", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      strategyKey: "three-rb",
    });

    const cappedTarget = state.availableTargets.find(target =>
      target.position === "WR" && target.tags.some(tag => tag.startsWith("path max $")),
    );

    expect(cappedTarget).toBeDefined();
    expect(cappedTarget?.personalValue).toBeGreaterThan(cappedTarget?.recommendedMaxBid ?? 0);
    expect(cappedTarget?.strategyValues["three-rb"]).toBe(cappedTarget?.personalValue);
  });
});
