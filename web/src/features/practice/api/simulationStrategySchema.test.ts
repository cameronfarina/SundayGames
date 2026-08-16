import { describe, expect, it } from "vitest";
import { positionSchema, strategySchema, targetOutcomeSchema } from "./simulationStrategySchema";

describe("simulation strategy schemas", () => {
  it("validates strategy targets and position preferences", () => {
    const result = strategySchema.parse({
      pairWithPlayerName: "De'Von Achane",
      positionCaps: [{ excludeNamedTargets: true, maxAuctionPrice: 25, position: "WR" }],
      preferredPositions: [{ maxAuctionPrice: 70, position: "RB", targetCount: 2, tier: "elite" }],
      rawInput: "Draft two elite running backs.",
      summary: "Two elite RBs",
      target: { maxAuctionPrice: 70, playerName: "Jahmyr Gibbs" },
      targets: [{ maxSnakeOverallPick: 12, maxSnakeRound: 1, playerName: "Bijan Robinson" }],
      warnings: [],
    });

    expect(result.preferredPositions[0]?.position).toBe("RB");
    expect(positionSchema.safeParse("DST").success).toBe(false);
  });

  it("validates target outcomes", () => {
    const result = targetOutcomeSchema.parse({
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      message: "Already kept.",
      playerId: "player-1",
      playerName: "Jahmyr Gibbs",
      reason: "retained_by_other_team",
      status: "infeasible",
    });

    expect(result.reason).toBe("retained_by_other_team");
  });
});
