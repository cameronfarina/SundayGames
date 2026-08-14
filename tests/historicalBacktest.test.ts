import { describe, expect, it } from "vitest";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildHistoricalBacktest } from "../src/modeling/historicalBacktest.js";

describe("historical backtest", () => {
  it("requires at least two historical seasons", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const season2025Records = historicalRecords.filter(record => record.season === 2025);

    expect(() => buildHistoricalBacktest(season2025Records)).toThrow(
      "Historical backtest requires at least two seasons.",
    );
  });

  it("compares each historical draft against the other seasons as a leave-one-out baseline", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const report = buildHistoricalBacktest(historicalRecords);

    expect(report.method).toBe("leave-one-season-out");
    expect(report.historicalSeasons).toEqual([2023, 2024, 2025]);
    expect(report.summary).toMatchObject({
      seasonCount: 3,
      credible: true,
      failCount: 0,
    });
    expect(report.summary.gateCount).toBeGreaterThan(50);
    expect(report.summary.passCount + report.summary.warnCount + report.summary.failCount)
      .toBe(report.summary.gateCount);
    expect(report.summary.largestDeltas).toHaveLength(10);
    expect(report.summary.largestDeltas[0]).toMatchObject({
      status: "warn",
      thresholdPressure: expect.any(Number),
    });
    expect(report.summary.largestDeltas.some(delta => delta.category === "high_price_volume"))
      .toBe(true);

    const season2025 = report.seasonBacktests.find(backtest => backtest.season === 2025);
    expect(season2025).toBeDefined();
    expect(season2025?.sourceSeasons).toEqual([2023, 2024]);
    expect(season2025?.actual.openAuctionSpend).toBe(2621);
    expect(season2025?.baseline.openAuctionSpend).toBe(2606.5);

    const spendGate2025 = season2025?.gates.items.find(gate => gate.key === "open-auction-spend");
    expect(spendGate2025).toMatchObject({
      category: "open_auction_spend",
      label: "Open auction spend",
      status: "pass",
      target: 2606.5,
      actual: 2621,
      delta: 14.5,
    });

    const highPriceVolume2024 = report.seasonBacktests
      .find(backtest => backtest.season === 2024)
      ?.gates.items.find(gate => gate.key === "high-price-volume:80-plus");
    expect(highPriceVolume2024).toMatchObject({
      category: "high_price_volume",
      label: "$80+ player count",
      status: "warn",
      target: 0,
      actual: 1,
      delta: 1,
    });

    const qbCount2023 = report.seasonBacktests
      .find(backtest => backtest.season === 2023)
      ?.gates.items.find(gate => gate.key === "position-count:QB");
    expect(qbCount2023).toMatchObject({
      category: "position_count",
      label: "QB roster count",
      target: 22.5,
      actual: 22,
      delta: -0.5,
    });

    for (const backtest of report.seasonBacktests) {
      expect(new Set(backtest.gates.items.map(gate => gate.key)).size).toBe(backtest.gates.items.length);
      expect(backtest.gates.items.filter(gate => gate.label === "$1 player count")).toHaveLength(1);
    }

    expect(report.notes).toContain(
      "Backtest compares historical seasons against other historical seasons only; it does not claim projection accuracy without historical projection files.",
    );
  });

  it("returns an isolated report that callers cannot mutate across builds", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const first = buildHistoricalBacktest(historicalRecords);
    first.notes.length = 0;

    const second = buildHistoricalBacktest(historicalRecords);
    expect(second.notes).toHaveLength(3);
  });
});
