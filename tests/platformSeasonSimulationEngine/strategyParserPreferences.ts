import { expect, it } from "vitest";
import { parseSeasonSimulationStrategy } from "../../src/platform/seasonSimulationEngine.js";

export const registerStrategyParserPreferenceTests = (): void => {
  it("reports only the auction target, preferred position, and pairing it can honor", () => {
    const strategy = parseSeasonSimulationStrategy(
      "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
    );

    expect(strategy).toEqual({
      rawInput: "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
      target: {
        playerName: "Jadarian Price",
        maxAuctionPrice: 20,
      },
      targets: [{
        playerName: "Jadarian Price",
        maxAuctionPrice: 20,
      }],
      preferredPositions: [{ position: "RB", tier: "elite" }],
      pairWithPlayerName: "Achane",
      summary: "Target Jadarian Price up to $20; prioritize elite RB; pair with Achane.",
      warnings: [],
    });
  });

  it("parses snake deadlines and warns about strategy language it does not support", () => {
    expect(parseSeasonSimulationStrategy("Draft Ja'Marr Chase no later than round 3"))
      .toMatchObject({
        target: { playerName: "Ja'Marr Chase", maxSnakeRound: 3 },
        summary: "Target Ja'Marr Chase by round 3.",
        warnings: [],
      });
    expect(parseSeasonSimulationStrategy("Draft Puka Nacua by pick 18 and avoid week 6 byes"))
      .toMatchObject({
        target: { playerName: "Puka Nacua", maxSnakeOverallPick: 18 },
        warnings: ["Unsupported strategy phrase: \"avoid week 6 byes\"."],
      });
  });

  it("parses a named target without inventing a price or pick constraint", () => {
    expect(parseSeasonSimulationStrategy("Target CeeDee Lamb"))
      .toMatchObject({
        target: { playerName: "CeeDee Lamb" },
        summary: "Target CeeDee Lamb.",
        warnings: [],
      });
  });

  it("parses a counted position target with an auction cap", () => {
    expect(parseSeasonSimulationStrategy(
      "Run 100 simulations where I draft 2 elite RBs for no more than $70 each",
    )).toMatchObject({
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
};
