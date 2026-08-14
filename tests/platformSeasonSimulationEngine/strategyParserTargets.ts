import { expect, it } from "vitest";
import { parseSeasonSimulationStrategy } from "../../src/platform/seasonSimulationEngine.js";

export const registerStrategyParserTargetTests = (): void => {
  it("parses a cap for untargeted players at a position", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft Ladd for no more than $25. Do not spend over $25 on another WR.",
    );

    expect(strategy).toMatchObject({
      targets: [{ playerName: "Ladd", maxAuctionPrice: 25 }],
      positionCaps: [{ position: "WR", maxAuctionPrice: 25, excludeNamedTargets: true }],
      summary: "Target Ladd up to $25; cap other WRs at $25.",
      warnings: [],
    });
  });

  it("parses the complete multi-target strategy used by the Practice UI", () => {
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
      summary: "Target jadarian price up to $19; target gibbs up to $78; target kyler murray up to $2; target ladd up to $25; cap other WRs at $25.",
      warnings: [],
    });
  });

  it("parses multiple named auction targets with independent price caps", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft jadarian price for no more than $20. Draft gibbs for no more than $76",
    );

    expect(strategy).toMatchObject({
      targets: [
        { playerName: "jadarian price", maxAuctionPrice: 20 },
        { playerName: "gibbs", maxAuctionPrice: 76 },
      ],
      summary: "Target jadarian price up to $20; target gibbs up to $76.",
      warnings: [],
    });
  });

  it.each([
    {
      input: "draft Gibbs by pick 5 and draft Chase by round 2",
      targets: [
        { playerName: "Gibbs", maxSnakeOverallPick: 5 },
        { playerName: "Chase", maxSnakeRound: 2 },
      ],
    },
    {
      input: "draft Gibbs and draft Chase under $74",
      targets: [
        { playerName: "Gibbs" },
        { playerName: "Chase", maxAuctionPrice: 73 },
      ],
    },
    {
      input: "target Gibbs and target Chase",
      targets: [{ playerName: "Gibbs" }, { playerName: "Chase" }],
    },
    {
      input: "target Gibbs; target Chase under $70",
      targets: [
        { playerName: "Gibbs" },
        { playerName: "Chase", maxAuctionPrice: 69 },
      ],
    },
    {
      input: "target Gibbs, target Chase under $70",
      targets: [
        { playerName: "Gibbs" },
        { playerName: "Chase", maxAuctionPrice: 69 },
      ],
    },
  ])("keeps separate target clauses in source order: $input", ({ input, targets }) => {
    expect(parseSeasonSimulationStrategy(input)).toMatchObject({ targets, warnings: [] });
  });
};
