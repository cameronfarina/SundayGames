import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
} from "../src/modeling/keeperInflation.js";
import { loadCurrentProjections } from "../src/projections.js";

describe("keeper inflation scenarios", () => {
  it("expands keeper counts as assumptions are included", () => {
    const scenarios = buildKeeperScenarios(keepers);
    const confirmed = scenarios.find(scenario => scenario.key === "confirmedOnly");
    const expected = scenarios.find(scenario => scenario.key === "expected");
    if (confirmed === undefined || expected === undefined) throw new Error("Missing keeper scenarios.");

    const confirmedCount = Object.values(confirmed.keeperCounts).reduce((sum, count) => sum + count, 0);
    const expectedCount = Object.values(expected.keeperCounts).reduce((sum, count) => sum + count, 0);
    expect(confirmedCount).toBe(4);
    expect(expectedCount).toBeGreaterThanOrEqual(keepers.length);
    expect(expectedCount).toBeGreaterThan(confirmedCount);
    expect(expected.totalKeeperCost).toBeGreaterThan(confirmed.totalKeeperCost);
  });

  it("removes included synthetic keepers from the auction pool", async () => {
    const projections = await loadCurrentProjections();
    const records = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, records);
    const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === "expected");
    if (scenario === undefined) throw new Error("Missing expected keeper scenario.");
    const expected = applyKeeperScenarioToPrices(prices, scenario, keepers);
    const available = new Set(expected.availablePrices.map(price => price.name));

    expect(keepers.every(keeper => !available.has(keeper.player))).toBe(true);
  });
});
