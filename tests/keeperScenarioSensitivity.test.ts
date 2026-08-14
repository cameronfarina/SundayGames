import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import {
  buildKeeperScenarioSensitivityReport,
  keeperScenarioSensitivityCsv,
} from "../src/modeling/keeperScenarioSensitivity.js";
import type {
  KeeperReasonMaps,
  ScenarioPriceMaps,
} from "../src/modeling/keeperScenarioSensitivity/contracts.js";
import { statesForPrice } from "../src/modeling/keeperScenarioSensitivity/playerStates.js";
import { requiredScenario } from "../src/modeling/keeperScenarioSensitivity/scenarioResources.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

const pricesFixture = async () => {
  const projections = await loadEspnWeeksOneToFour(projectionPath);
  const historicalRecords = await loadHistoricalAuctionRecords();
  return buildBasePrices(projections, historicalRecords);
};

const reportFixture = async () => {
  const prices = await pricesFixture();
  return buildKeeperScenarioSensitivityReport({ prices, keepers, limit: prices.length });
};

const emptyPriceMaps = (): ScenarioPriceMaps => ({
  confirmedOnly: new Map(),
  expected: new Map(),
  highRetention: new Map(),
});

const emptyReasonMaps = (): KeeperReasonMaps => ({
  confirmedOnly: new Map(),
  expected: new Map(),
  highRetention: new Map(),
});

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

  it("reports and safely exports an assumed keeper outside the priced pool", async () => {
    const prices = await pricesFixture();
    const unpricedKeeper = {
      owner: "Owner, 15",
      player: "Quoted \"Prospect\"",
      position: "WR",
      priorCost: 4,
      newCost: 5,
      status: "assumed",
    } satisfies (typeof keepers)[number];
    const report = buildKeeperScenarioSensitivityReport({
      prices,
      keepers: [...keepers, unpricedKeeper],
      limit: prices.length + 1,
    });
    const row = report.rows.find(candidate => candidate.player === unpricedKeeper.player);

    expect(report.summary.unpricedKeeperCount).toBe(1);
    expect(row).toMatchObject({
      pricedPool: false,
      basePrice: null,
      keeperRemoved: true,
      keeperRemovalChanged: true,
      availabilityChanged: false,
      unavailableScenarios: ["confirmedOnly", "expected", "highRetention"],
      keeperRemovalScenarios: ["expected", "highRetention"],
    });
    expect(row?.scenarios.confirmedOnly.unavailableReason).toBe("outside priced auction pool");
    expect(row?.scenarios.expected.unavailableReason).toBe(
      "Owner, 15 assumed keeper at $5",
    );
    expect(keeperScenarioSensitivityCsv(report)).toContain(
      '"Quoted ""Prospect"""',
    );
  });

  it("handles a new league with no priced players or keepers", () => {
    const report = buildKeeperScenarioSensitivityReport({ prices: [], keepers: [] });

    expect(report.rows).toEqual([]);
    expect(report.summary).toMatchObject({
      playerCount: 0,
      reportedPlayerCount: 0,
      truncated: false,
      maxPriceSpread: 0,
      averagePriceSpread: 0,
    });
  });

  it("keeps an open unpriced declaration outside every scenario", () => {
    const openKeeper = {
      owner: "Owner15",
      player: "Future Prospect",
      position: "RB",
      priorCost: 1,
      newCost: 2,
      status: "open",
    } satisfies (typeof keepers)[number];
    const report = buildKeeperScenarioSensitivityReport({
      prices: [],
      keepers: [openKeeper],
    });

    expect(report.rows[0]).toMatchObject({
      keeperRemoved: false,
      keeperRemovalChanged: false,
      sortScore: 0,
    });
  });

  it("prioritizes a confirmed unpriced keeper below scenario-changing removals", () => {
    const confirmedKeeper = {
      owner: "Owner15",
      player: "Confirmed Prospect",
      position: "TE",
      priorCost: 2,
      newCost: 3,
      status: "confirmed",
    } satisfies (typeof keepers)[number];
    const report = buildKeeperScenarioSensitivityReport({
      prices: [],
      keepers: [confirmedKeeper],
    });

    expect(report.rows[0]).toMatchObject({
      keeperRemoved: true,
      keeperRemovalChanged: false,
      sortScore: 900,
    });
  });

  it("distinguishes an unexplained missing scenario price from a keeper removal", async () => {
    const prices = await pricesFixture();
    const price = prices[0];
    if (price === undefined) throw new Error("Expected a price fixture.");

    expect(statesForPrice(price, emptyPriceMaps(), emptyReasonMaps()).expected).toEqual({
      available: false,
      scenarioPrice: null,
      scenarioFactor: null,
      keeperRemoved: false,
    });
  });

  it("rejects a missing required scenario explicitly", () => {
    expect(() => requiredScenario([], "expected")).toThrow(
      'Unknown keeper scenario "expected".',
    );
  });
});
