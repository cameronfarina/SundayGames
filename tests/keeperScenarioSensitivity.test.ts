import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import {
  buildKeeperScenarioSensitivityReport,
  keeperScenarioSensitivityCsv,
} from "../src/modeling/keeperScenarioSensitivity.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

const reportFixture = async () => {
  const projections = await loadEspnWeeksOneToFour(projectionPath);
  const historicalRecords = await loadHistoricalAuctionRecords();
  const prices = buildBasePrices(projections, historicalRecords);

  return buildKeeperScenarioSensitivityReport({ prices, keepers, limit: prices.length });
};

describe("keeper scenario sensitivity report", () => {
  it("shows availability changes for an assumed synthetic keeper", async () => {
    const report = await reportFixture();
    const assumed = keepers.find(keeper => keeper.status === "assumed");
    if (assumed === undefined) throw new Error("Expected an assumed keeper fixture.");
    const row = report.rows.find(candidate => candidate.player === assumed.player);

    expect(report.summary.availabilityChangeCount).toBeGreaterThan(0);
    expect(row).toMatchObject({
      keeperRemoved: true,
      keeperRemovalChanged: true,
      availabilityChanged: true,
      unavailableScenarios: ["expected", "highRetention"],
    });
    expect(row?.scenarios.confirmedOnly.available).toBe(true);
    expect(row?.scenarios.expected).toMatchObject({
      available: false,
      unavailableReason: `${assumed.owner} assumed keeper at $${assumed.newCost}`,
    });
    expect(keeperScenarioSensitivityCsv(report)).toContain(assumed.player);
  });

  it("keeps confirmed removals unavailable in every scenario", async () => {
    const report = await reportFixture();
    const confirmed = keepers.find(keeper => keeper.status === "confirmed");
    if (confirmed === undefined) throw new Error("Expected a confirmed keeper fixture.");
    const row = report.rows.find(candidate => candidate.player === confirmed.player);

    expect(row).toMatchObject({
      keeperRemoved: true,
      keeperRemovalChanged: false,
      availabilityChanged: false,
      unavailableScenarios: ["confirmedOnly", "expected", "highRetention"],
    });
    expect(row?.scenarios.confirmedOnly).toMatchObject({
      available: false,
      unavailableReason: `${confirmed.owner} confirmed keeper at $${confirmed.newCost}`,
    });
  });
});
