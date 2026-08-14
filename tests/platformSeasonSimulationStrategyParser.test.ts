import { describe, expect, it } from "vitest";
import { parseSeasonSimulationStrategy } from "../src/platform/seasonSimulationEngine/strategyParser.js";

describe("season simulation strategy parser", () => {
  it("keeps every uncapped player target in source order", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft jadarian price. draft Ja'Marr Chase. draft Jared Goff. draft Jaylen Warren. draft Ladd McConkey.",
    );

    expect(strategy.targets).toEqual([
      { playerName: "jadarian price" },
      { playerName: "Ja'Marr Chase" },
      { playerName: "Jared Goff" },
      { playerName: "Jaylen Warren" },
      { playerName: "Ladd McConkey" },
    ]);
    expect(strategy.target).toEqual({ playerName: "jadarian price" });
    expect(strategy.warnings).toEqual([]);
  });

  it("accepts natural prioritize phrases as named targets", () => {
    const strategy = parseSeasonSimulationStrategy(
      "prioritize jadarian price, prioritize jeanty, prioritize tate, prioritize goff, prioritize ladd",
    );

    expect(strategy.targets).toEqual([
      { playerName: "jadarian price" },
      { playerName: "jeanty" },
      { playerName: "tate" },
      { playerName: "goff" },
      { playerName: "ladd" },
    ]);
    expect(strategy.warnings).toEqual([]);
  });

  it("parses independent target prices and excludes them from a position cap", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft jadarian price for under $20, draft gibbs for no more than $78. Draft kyler murray for no more than $2. draft ladd for no more than $25 draft. do not spend over $25 on another WR.",
    );

    expect(strategy).toMatchObject({
      targets: [
        { playerName: "jadarian price", maxAuctionPrice: 19 },
        { playerName: "gibbs", maxAuctionPrice: 78 },
        { playerName: "kyler murray", maxAuctionPrice: 2 },
        { playerName: "ladd", maxAuctionPrice: 25 },
      ],
      positionCaps: [{ position: "WR", maxAuctionPrice: 25, excludeNamedTargets: true }],
      warnings: [],
    });
  });

  it("preserves auction and snake constraints in source order", () => {
    const strategy = parseSeasonSimulationStrategy(
      "target Gibbs by pick 5 and draft Chase no later than round 2 and target Ladd under $25",
    );

    expect(strategy.targets).toEqual([
      { playerName: "Gibbs", maxSnakeOverallPick: 5 },
      { playerName: "Chase", maxSnakeRound: 2 },
      { playerName: "Ladd", maxAuctionPrice: 24 },
    ]);
  });

  it("parses counted elite-position preferences with a per-player cap", () => {
    const strategy = parseSeasonSimulationStrategy(
      "Run 100 simulations where I draft two elite RBs for no more than $70 each",
    );

    expect(strategy).toMatchObject({
      preferredPositions: [{
        position: "RB",
        tier: "elite",
        targetCount: 2,
        maxAuctionPrice: 70,
      }],
      summary: "Prioritize 2 elite RB up to $70 each.",
      warnings: [],
    });
  });

  it("combines a target, elite-position preference, and pairing", () => {
    const strategy = parseSeasonSimulationStrategy(
      "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
    );

    expect(strategy).toMatchObject({
      targets: [{ playerName: "Jadarian Price", maxAuctionPrice: 20 }],
      preferredPositions: [{ position: "RB", tier: "elite" }],
      pairWithPlayerName: "Achane",
      summary: "Target Jadarian Price up to $20; prioritize elite RB; pair with Achane.",
      warnings: [],
    });
  });

  it("reports unsupported language after preserving supported constraints", () => {
    const strategy = parseSeasonSimulationStrategy(
      "Draft Puka Nacua by pick 18 and avoid week 6 byes",
    );

    expect(strategy).toMatchObject({
      targets: [{ playerName: "Puka Nacua", maxSnakeOverallPick: 18 }],
      warnings: ["Unsupported strategy phrase: \"avoid week 6 byes\"."],
    });
  });

  it("rejects non-positive price constraints without inventing a target", () => {
    expect(parseSeasonSimulationStrategy("draft Ladd under $1")).toEqual({
      rawInput: "draft Ladd under $1",
      targets: [],
      preferredPositions: [],
      summary: "Best available roster fit.",
      warnings: [],
    });
    expect(parseSeasonSimulationStrategy("do not spend over $0 on another WR"))
      .toMatchObject({
        targets: [],
        preferredPositions: [],
        summary: "Best available roster fit.",
        warnings: [],
      });
  });

  it("deduplicates equivalent elite-position preferences", () => {
    expect(parseSeasonSimulationStrategy("target elite RB and prioritize top RB"))
      .toMatchObject({
        preferredPositions: [{ position: "RB", tier: "elite" }],
        summary: "Prioritize elite RB.",
        warnings: [],
      });
  });

  it("validates elite-tier caps and applies general position caps", () => {
    expect(parseSeasonSimulationStrategy(
      "draft 2 elite RBs for no more than $0 each",
    )).toMatchObject({
      preferredPositions: [],
      warnings: ["Unsupported strategy phrase: \"2 elite RBs for no more than $0 each\"."],
    });
    expect(parseSeasonSimulationStrategy("never pay more than $30 for RBs"))
      .toMatchObject({
        positionCaps: [{ position: "RB", maxAuctionPrice: 30, excludeNamedTargets: false }],
        summary: "Cap RBs at $30.",
        warnings: [],
      });
  });

  it("uses the best-available default for an empty strategy", () => {
    expect(parseSeasonSimulationStrategy("")).toEqual({
      rawInput: "",
      targets: [],
      preferredPositions: [],
      summary: "Best available roster fit.",
      warnings: [],
    });
  });
});
