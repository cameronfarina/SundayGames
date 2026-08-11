import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { leagueConfig, ownerOrder, positions, type Owner } from "../config/league.js";
import { buildHistoricalCalibrationAudit } from "../src/modeling/calibrationAudit.js";
import { runMockBatch } from "../src/modeling/mockBatch.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildPricingConfigFromSources } from "../src/pricingConfig.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

const auctionSpendForOwner = (
  run: ReturnType<typeof runMockBatch>["runs"][number],
  owner: Owner,
): number =>
  run.picks
    .filter(pick => pick.owner === owner)
    .reduce((total, pick) => total + pick.price, 0);

const scenarioOpenBudgetForOwner = (
  batch: ReturnType<typeof runMockBatch>,
  owner: Owner,
): number =>
  roundToTwo(average(batch.runs.map(run => {
    const auctionSpend = auctionSpendForOwner(run, owner);
    const roster = run.rosters.find(summary => summary.owner === owner);
    if (!roster) throw new Error(`Missing roster for ${owner}.`);

    const keeperSpend = roster.spend - auctionSpend;
    return leagueConfig.auctionBudget - keeperSpend;
  })));

describe("historical calibration audit", () => {
  it("compares batch mock economics to historical league auctions", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const runsPerScenario = 20;
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario,
      seedPrefix: "calibration-test",
      diagnosticsMode: "summary",
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });

    expect(audit.runCount).toBe(runsPerScenario);
    expect(audit.summary.runCount).toBe(runsPerScenario);
    expect(audit.summary.scenarioKeys).toEqual(["expected"]);
    expect(audit.summary.runsPerScenario).toBe(runsPerScenario);
    expect(["pass", "warn", "fail"]).toContain(audit.gates.summary.status);
    expect(audit.gates.summary.passCount + audit.gates.summary.warnCount + audit.gates.summary.failCount)
      .toBe(audit.gates.summary.gateCount);
    expect(audit.gates.summary.credible).toBe(audit.gates.summary.failCount === 0);
    expect(audit.historicalSeasons).toEqual([2023, 2024, 2025]);
    expect(audit.priceTiers.map(tier => tier.key)).toEqual(["elite", "strong", "starter", "depth", "dollar"]);
    expect(audit.highPriceVolumes.map(volume => volume.threshold)).toEqual([70, 75, 80]);
    expect(audit.positionCounts.map(position => position.position)).toEqual([...positions]);
    expect(audit.positionSpend.map(position => position.position)).toEqual([...positions]);
    expect(audit.ownerSpend).toHaveLength(ownerOrder.length);
    expect(audit.scenarios).toHaveLength(1);
    expect(audit.scenarios[0]).toMatchObject({
      key: "expected",
      label: "Expected",
      runCount: runsPerScenario,
      invalidRosterCount: 0,
      scenarioAverageOpenAuctionDollars: audit.overall.scenarioAverageOpenAuctionDollars,
    });
    expect(audit.scenarios[0]?.mockAverageAuctionSpend).toBeGreaterThan(0);
    expect(audit.scenarios[0]?.leagueAverageBudgetRemaining).toBeGreaterThanOrEqual(0);
    expect(audit.scenarios[0]?.maxOwnerAverageBudgetRemaining).toBeGreaterThanOrEqual(
      audit.scenarios[0]?.leagueAverageBudgetRemaining ?? 0,
    );
    expect(audit.overall.mockAverageAuctionSpend).toBeGreaterThan(0);
    expect(audit.overall.historicalAverageAuctionSpend).toBeGreaterThan(0);
    expect(audit.overall.scenarioAverageOpenAuctionDollars).toBeGreaterThan(
      audit.overall.historicalAverageAuctionSpend,
    );

    const auctionSpendGate = audit.gates.items.find(gate => gate.key === "auction-spend");
    expect(auctionSpendGate).toMatchObject({
      category: "auction_spend",
      status: "pass",
      target: audit.overall.scenarioAverageOpenAuctionDollars,
      actual: audit.overall.mockAverageAuctionSpend,
      delta: audit.overall.scenarioAuctionSpendDelta,
    });

    const rawScenarioSpendTarget = (position: "RB" | "WR" | "TE"): number => {
      const positionSpend = audit.positionSpend.find(candidate => candidate.position === position);
      if (!positionSpend) throw new Error(`Missing ${position} spend calibration.`);
      return roundToTwo(
        positionSpend.historicalAverageSpend *
        audit.overall.scenarioAverageOpenAuctionDollars /
        audit.overall.historicalAverageAuctionSpend,
      );
    };

    const rbSpend = audit.positionSpend.find(position => position.position === "RB");
    const wrSpend = audit.positionSpend.find(position => position.position === "WR");
    const teSpend = audit.positionSpend.find(position => position.position === "TE");
    expect(rbSpend).toBeDefined();
    expect(wrSpend).toBeDefined();
    expect(teSpend).toBeDefined();
    expect(Number.isFinite(rbSpend?.delta ?? Number.NaN)).toBe(true);
    expect(rbSpend?.scenarioSpendDelta).toBe(
      roundToTwo((rbSpend?.mockAverageSpend ?? 0) - (rbSpend?.scenarioAverageSpendTarget ?? 0)),
    );
    expect(teSpend?.scenarioAverageSpendTarget).toBeLessThan(rawScenarioSpendTarget("TE") - 30);
    expect(wrSpend?.scenarioAverageSpendTarget).toBeGreaterThan(rawScenarioSpendTarget("WR"));

    const rbSpendGate = audit.gates.items.find(gate => gate.key === "position-spend:RB");
    expect(rbSpendGate).toMatchObject({
      category: "position_spend",
      label: "RB spend",
      target: rbSpend?.scenarioAverageSpendTarget,
      actual: rbSpend?.mockAverageSpend,
      delta: rbSpend?.scenarioSpendDelta,
    });

    const qbCount = audit.positionCounts.find(position => position.position === "QB");
    expect(qbCount).toMatchObject({
      historicalAverageCount: 22.33,
    });
    expect(Number.isFinite(qbCount?.delta ?? Number.NaN)).toBe(true);
    expect(qbCount?.mockAverageCount).toBeLessThanOrEqual(24);

    const teCount = audit.positionCounts.find(position => position.position === "TE");
    expect(teCount?.mockAverageCount).toBeLessThanOrEqual(23);

    const qbCountGate = audit.gates.items.find(gate => gate.key === "position-count:QB");
    expect(qbCountGate).toMatchObject({
      category: "position_count",
      label: "QB roster count",
      target: qbCount?.historicalAverageCount,
      actual: qbCount?.mockAverageCount,
      delta: qbCount?.delta,
    });

    const beaton = audit.ownerSpend.find(owner => owner.owner === "Beaton");
    expect(beaton).toBeDefined();
    expect(Number.isFinite(beaton?.mockAverageAuctionSpend ?? Number.NaN)).toBe(true);

    const seth = audit.ownerSpend.find(owner => owner.owner === "Seth");
    const sethScenarioOpenBudget = scenarioOpenBudgetForOwner(batch, "Seth");
    expect(seth).toMatchObject({
      scenarioAverageOpenAuctionBudget: sethScenarioOpenBudget,
    });
    expect(seth?.scenarioSpendDelta).toBe(
      roundToTwo((seth?.mockAverageAuctionSpend ?? 0) - sethScenarioOpenBudget),
    );

    const sethSpendGate = audit.gates.items.find(gate => gate.key === "owner-spend:Seth");
    expect(sethSpendGate).toMatchObject({
      category: "owner_spend",
      label: "Seth scenario auction spend",
      status: "pass",
      target: seth?.scenarioAverageOpenAuctionBudget,
      actual: seth?.mockAverageAuctionSpend,
      delta: seth?.scenarioSpendDelta,
    });

    expect(audit.summary.largestPriceTierCountDeltas).toHaveLength(3);
    expect(audit.summary.largestPositionCountDeltas).toHaveLength(3);
    expect(audit.summary.largestPositionSpendDeltas).toHaveLength(3);
    expect(audit.summary.largestOwnerSpendDeltas).toHaveLength(5);
    for (const positionDelta of audit.summary.largestPositionSpendDeltas) {
      const positionSpend = audit.positionSpend.find(position => position.position === positionDelta.key);
      expect(positionDelta).toMatchObject({
        target: positionSpend?.scenarioAverageSpendTarget,
        actual: positionSpend?.mockAverageSpend,
        delta: positionSpend?.scenarioSpendDelta,
      });
    }
    for (const ownerDelta of audit.summary.largestOwnerSpendDeltas) {
      const ownerSpend = audit.ownerSpend.find(owner => owner.owner === ownerDelta.key);
      expect(ownerDelta).toMatchObject({
        target: ownerSpend?.scenarioAverageOpenAuctionBudget,
        actual: ownerSpend?.mockAverageAuctionSpend,
        delta: ownerSpend?.scenarioSpendDelta,
      });
    }
    expect(audit.summary.budgetRemaining.leagueAverageBudgetRemaining).toBeGreaterThanOrEqual(0);
    expect(audit.summary.budgetRemaining.ownersWithAverageBudgetRemaining.every(owner =>
      owner.averageBudgetRemaining > 0,
    )).toBe(true);

    const dollarPlayerGate = audit.gates.items.find(gate => gate.key === "price-tier-count:dollar");
    expect(dollarPlayerGate).toMatchObject({
      category: "price_tier_count",
      label: "$1 player count",
      status: "pass",
      target: audit.overall.historicalAverageDollarPlayers,
      actual: audit.overall.mockAverageDollarPlayers,
      delta: audit.overall.dollarPlayerDelta,
    });
    expect(dollarPlayerGate?.warnThreshold).toBeLessThan(dollarPlayerGate?.failThreshold ?? 0);

    const eightyPlusVolume = audit.highPriceVolumes.find(volume => volume.threshold === 80);
    expect(eightyPlusVolume).toMatchObject({
      historicalAverageCount: 0.33,
      historicalMaxCount: 1,
    });
    expect(eightyPlusVolume?.mockMaxCount).toBeLessThanOrEqual(eightyPlusVolume?.historicalMaxCount ?? 0);

    const eightyPlusGate = audit.gates.items.find(gate => gate.key === "high-price-volume:80-plus");
    expect(eightyPlusGate).toMatchObject({
      category: "high_price_volume",
      label: "$80+ player count",
      status: "pass",
      mode: "maximum",
      target: eightyPlusVolume?.historicalMaxCount,
      actual: eightyPlusVolume?.mockMaxCount,
      delta: eightyPlusVolume?.maxCountDelta,
    });

    const invalidRosterGate = audit.gates.items.find(gate => gate.key === "roster-validity");
    expect(invalidRosterGate).toMatchObject({
      category: "roster_validity",
      status: "pass",
      target: 0,
      actual: 0,
      delta: 0,
    });

    const timidBatch = {
      ...batch,
      runs: batch.runs.map(run => ({
        ...run,
        picks: run.picks.map(pick => ({
          ...pick,
          price: Math.min(pick.price, 69),
        })),
      })),
    };
    const timidAudit = buildHistoricalCalibrationAudit({ historicalRecords, batch: timidBatch });

    const seventyPlusFloorGate = timidAudit.gates.items.find(
      gate => gate.key === "high-price-volume-floor:70-plus",
    );
    expect(seventyPlusFloorGate).toMatchObject({
      category: "high_price_volume",
      label: "$70+ player count floor",
      status: "fail",
      mode: "minimum",
      target: 4.33,
      actual: 0,
      delta: -4.33,
    });

    const seventyFivePlusFloorGate = timidAudit.gates.items.find(
      gate => gate.key === "high-price-volume-floor:75-plus",
    );
    expect(seventyFivePlusFloorGate).toMatchObject({
      category: "high_price_volume",
      label: "$75+ player count floor",
      status: "warn",
      mode: "minimum",
      target: 2.33,
      actual: 0,
      delta: -2.33,
    });
  }, 15000);

  it("keeps production-sized position spend inside the historical calibration bands", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const pricingConfig = await buildPricingConfigFromSources();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 50,
      seedPrefix: "tuning-baseline",
      pricingConfig,
      diagnosticsMode: "summary",
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });

    const positionSpendGates = audit.gates.items.filter(gate => gate.category === "position_spend");
    const budgetRemainingGate = audit.gates.items.find(gate => gate.key === "budget-remaining:league-average");
    const qbSpendGate = audit.gates.items.find(gate => gate.key === "position-spend:QB");
    const qbCount = audit.positionCounts.find(position => position.position === "QB");
    const premiumTopEndFloorGate = audit.gates.items.find(
      gate => gate.key === "high-price-volume-floor:75-plus",
    );
    const eliteTopEndGate = audit.gates.items.find(gate => gate.key === "high-price-volume:80-plus");

    expect(qbSpendGate).toMatchObject({
      category: "position_spend",
      label: "QB spend",
      status: "pass",
    });
    expect(positionSpendGates.every(gate => gate.status === "pass")).toBe(true);
    expect(budgetRemainingGate).toMatchObject({
      category: "budget_remaining",
      label: "League average budget remaining",
      status: "pass",
    });
    expect(qbCount?.mockAverageCount).toBeGreaterThanOrEqual(21);
    expect(qbCount?.mockAverageCount).toBeLessThanOrEqual(24);
    expect(premiumTopEndFloorGate).toMatchObject({
      category: "high_price_volume",
      label: "$75+ player count floor",
      status: "pass",
    });
    expect(eliteTopEndGate).toMatchObject({
      category: "high_price_volume",
      label: "$80+ player count",
      status: "pass",
    });
  }, 30000);
});
