import { describe, expect, it } from "vitest";
import {
  buildAroundStrategyLabScenarios,
  strategyLabReportMarkdown,
  type StrategyLabReport,
} from "../strategyLab.js";

describe("strategy lab public contract", () => {
  it("keeps the exact public export surface", async () => {
    const strategyLab = await import("../strategyLab.js");

    expect(Object.keys(strategyLab).sort()).toEqual([
      "buildAroundStrategyLabScenarios",
      "defaultStrategyLabScenarios",
      "runStrategyLab",
      "strategyLabReportMarkdown",
    ]);
  });

  it("normalizes build-around keys while preserving display names and price order", () => {
    const scenarios = buildAroundStrategyLabScenarios({
      player: "  Ja'Marr Chase  ",
      prices: [72, 68, 72],
      strategyKey: "wr-heavy",
    });

    expect(scenarios.map(scenario => ({
      key: scenario.key,
      label: scenario.label,
      forcedSales: scenario.forcedSales,
    }))).toEqual([
      {
        key: "build-around-ja-marr-chase-72",
        label: "Build around Ja'Marr Chase $72",
        forcedSales: [{ owner: "Owner11", player: "Ja'Marr Chase", price: 72 }],
      },
      {
        key: "build-around-ja-marr-chase-68",
        label: "Build around Ja'Marr Chase $68",
        forcedSales: [{ owner: "Owner11", player: "Ja'Marr Chase", price: 68 }],
      },
    ]);
  });

  it("rejects empty prices, invalid prices, and normalized forced-sale conflicts", () => {
    expect(() => buildAroundStrategyLabScenarios({
      player: "Puka Nacua",
      prices: [],
      strategyKey: "balanced",
    })).toThrow("Build-around scenarios require at least one price.");
    expect(() => buildAroundStrategyLabScenarios({
      player: "Puka Nacua",
      prices: [0],
      strategyKey: "balanced",
    })).toThrow('Invalid build-around price "0".');
    expect(() => buildAroundStrategyLabScenarios({
      player: "Puka Nacua Jr.",
      prices: [70],
      strategyKey: "balanced",
      baseForcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 65 }],
    })).toThrow('Build-around player "Puka Nacua Jr." is already forced in the base path.');
  });

  it("preserves empty-report Markdown bytes", () => {
    const report: StrategyLabReport = {
      mode: "strategy-lab",
      options: {
        scenarioKey: "expected",
        runsPerScenario: 3,
        seedPrefix: "contract",
      },
      leaderboard: [],
      scenarios: [],
    };

    expect(strategyLabReportMarkdown(report)).toBe([
      "# Primary Team Strategy Lab",
      "",
      "Runs per scenario: 3",
      "",
      "## Leaderboard",
      "| Scenario | Avg rank | Best | Worst | Week 1 | Season strength | Thinness |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ].join("\n"));
  });
});
