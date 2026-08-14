import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildAroundStrategyLabScenarios,
  defaultStrategyLabScenarios,
  runStrategyLab,
  strategyLabReportMarkdown,
} from "../src/modeling/strategyLab.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("strategy lab", () => {
  it("compares forced Owner11 paths with budget pressure and realistic mock outcomes", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const report = await runStrategyLab({
      projections,
      historicalRecords,
      keepers,
      runsPerScenario: 2,
      seedPrefix: "strategy-lab-test",
    });

    const puka75 = report.scenarios.find(scenario => scenario.key === "puka-75");
    const puka80 = report.scenarios.find(scenario => scenario.key === "puka-80");
    const valueWrCook = report.scenarios.find(scenario => scenario.key === "value-wr-cook");

    expect(report.mode).toBe("strategy-lab");
    expect(report.options.runsPerScenario).toBe(2);
    expect(report.scenarios).toHaveLength(defaultStrategyLabScenarios.length);
    expect(report.leaderboard).toHaveLength(defaultStrategyLabScenarios.length);
    expect(puka75?.forcedSales).toEqual([{ owner: "Owner11", player: "Puka Nacua", price: 75 }]);
    expect(puka75?.camForcedStart.players).toEqual([
      { player: "Ashton Jeanty", position: "RB", price: 50, source: "keeper" },
      { player: "Puka Nacua", position: "WR", price: 75, source: "forced-sale" },
    ]);
    expect(puka75?.camForcedStart.budgetRemaining).toBe(75);
    expect(puka80?.camForcedStart.budgetRemaining).toBe(70);
    expect(puka80?.camForcedStart.maxBid).toBe((puka75?.camForcedStart.maxBid ?? 0) - 5);
    expect(puka75?.averageCamRank).toBeGreaterThanOrEqual(1);
    expect(puka75?.averageCamRank).toBeLessThanOrEqual(14);
    expect(puka75?.sampleBuilds).not.toHaveLength(0);
    expect(
      puka75?.sampleBuilds.every(build =>
        build.camPlayers.some(player => player.name === "Puka Nacua" && player.price === 75),
      ),
    ).toBe(true);
    expect(valueWrCook?.forcedSales).toEqual([]);
    expect(valueWrCook?.camForcedStart.players.map(player => player.player)).toEqual(["Ashton Jeanty"]);
    expect(valueWrCook?.targetMaxBids.map(target => target.player)).toEqual([
      "DeVonta Smith",
      "Ladd McConkey",
      "James Cook III",
    ]);
    expect(valueWrCook?.targetOutcomes).toHaveLength(3);
  }, 20000);

  it("builds forced Owner11 scenario sweeps around one player at multiple prices", () => {
    const scenarios = buildAroundStrategyLabScenarios({
      player: "Omarion Hampton",
      prices: [46, 48, 50],
      strategyKey: "three-rb",
      targetMaxBids: [{ owner: "Owner11", player: "Zay Flowers", maxBid: 31 }],
      baseForcedSales: [{ owner: "Owner11", player: "Jadarian Price", price: 18 }],
    });

    expect(scenarios).toEqual([
      {
        key: "build-around-omarion-hampton-46",
        label: "Build around Omarion Hampton $46",
        question: "If the primary team builds around Omarion Hampton at $46, what does the rest of the roster become?",
        strategyKey: "three-rb",
        forcedSales: [
          { owner: "Owner11", player: "Jadarian Price", price: 18 },
          { owner: "Owner11", player: "Omarion Hampton", price: 46 },
        ],
        targetMaxBids: [{ owner: "Owner11", player: "Zay Flowers", maxBid: 31 }],
        notes: "Build-around sweep: compare the same anchor at different price points.",
      },
      {
        key: "build-around-omarion-hampton-48",
        label: "Build around Omarion Hampton $48",
        question: "If the primary team builds around Omarion Hampton at $48, what does the rest of the roster become?",
        strategyKey: "three-rb",
        forcedSales: [
          { owner: "Owner11", player: "Jadarian Price", price: 18 },
          { owner: "Owner11", player: "Omarion Hampton", price: 48 },
        ],
        targetMaxBids: [{ owner: "Owner11", player: "Zay Flowers", maxBid: 31 }],
        notes: "Build-around sweep: compare the same anchor at different price points.",
      },
      {
        key: "build-around-omarion-hampton-50",
        label: "Build around Omarion Hampton $50",
        question: "If the primary team builds around Omarion Hampton at $50, what does the rest of the roster become?",
        strategyKey: "three-rb",
        forcedSales: [
          { owner: "Owner11", player: "Jadarian Price", price: 18 },
          { owner: "Owner11", player: "Omarion Hampton", price: 50 },
        ],
        targetMaxBids: [{ owner: "Owner11", player: "Zay Flowers", maxBid: 31 }],
        notes: "Build-around sweep: compare the same anchor at different price points.",
      },
    ]);
  });

  it("renders a markdown leaderboard for fast draft-prep review", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const report = await runStrategyLab({
      projections,
      historicalRecords,
      keepers,
      runsPerScenario: 1,
      seedPrefix: "strategy-lab-markdown",
    });
    const markdown = strategyLabReportMarkdown(report);

    expect(markdown).toContain("# Primary Team Strategy Lab");
    expect(markdown).toContain("Puka $75");
    expect(markdown).toContain("Budget after forced start");
    expect(markdown).toContain("Best sample");
  }, 20000);

  it("measures capped target outcomes without forcing targets onto Owner11's roster", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const report = await runStrategyLab({
      projections,
      historicalRecords,
      keepers,
      runsPerScenario: 2,
      seedPrefix: "strategy-lab-target-cap",
      scenarios: [{
        key: "puka-cap-1",
        label: "Puka cap $1",
        question: "If Owner11 only wants Puka at a fake-low cap, he should lose him and pivot.",
        strategyKey: "balanced",
        forcedSales: [],
        targetMaxBids: [{ owner: "Owner11", player: "Puka Nacua", maxBid: 1 }],
      }],
    });
    const scenario = report.scenarios[0];

    expect(scenario?.camForcedStart.players).toEqual([
      { player: "Ashton Jeanty", position: "RB", price: 50, source: "keeper" },
    ]);
    expect(scenario?.targetOutcomes).toEqual([
      expect.objectContaining({
        player: "Puka Nacua",
        maxBid: 1,
        draftedByCamCount: 0,
        draftedByCamRate: 0,
        draftedByOtherCount: 2,
      }),
    ]);
    expect(scenario?.targetOutcomes[0]?.averageSalePrice).toBeGreaterThan(1);
    expect(
      scenario?.sampleBuilds.every(build =>
        !build.camPlayers.some(player => player.name === "Puka Nacua"),
      ),
    ).toBe(true);
  }, 20000);
});
