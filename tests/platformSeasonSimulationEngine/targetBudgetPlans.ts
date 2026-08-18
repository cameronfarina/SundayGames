import { expect, it } from "vitest";
import type { SeasonSimulationTargetConstraint } from "../../src/platform/seasonSimulationEngine.js";
import { runTargetBudgetAuctionPlan } from "./simulationFixtures.js";

export const registerTargetBudgetPlanTests = (): void => {
  it.each([
    ["Premium Runner", "Value Runner", "alg001-95"],
    ["Value Runner", "Premium Runner", "alg001-3"],
  ])("acquires uncapped targets at modeled clearing prices in order %s then %s", (
    firstTarget,
    secondTarget,
    seedPrefix,
  ) => {
    const result = runTargetBudgetAuctionPlan(
      [
        { playerName: firstTarget },
        { playerName: secondTarget },
      ],
      seedPrefix,
    );
    const humanTeam = result.runs[0]?.teams.find(team => team.isUserTeam);

    expect(humanTeam?.roster.map(player => player.playerName).sort()).toEqual([
      "Premium Runner",
      "Value Runner",
    ]);
    expect(humanTeam?.spent).toBe(98);
    expect(humanTeam?.budgetRemaining).toBe(2);
    expect(humanTeam?.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Premium Runner", price: 58 }),
      expect.objectContaining({ playerName: "Value Runner", price: 40 }),
    ]));
  });

  it.each([
    ["Premium Runner", "Value Runner", "alg001-95"],
    ["Value Runner", "Premium Runner", "alg001-3"],
  ])("acquires an exactly affordable pair of capped targets in order %s then %s", (
    firstTarget,
    secondTarget,
    seedPrefix,
  ) => {
    const targetFor = (playerName: string): SeasonSimulationTargetConstraint => ({
      playerName,
      maxAuctionPrice: playerName === "Premium Runner" ? 61 : 39,
    });
    const result = runTargetBudgetAuctionPlan(
      [targetFor(firstTarget), targetFor(secondTarget)],
      seedPrefix,
    );
    const humanTeam = result.runs[0]?.teams.find(team => team.isUserTeam);

    expect(result.targetOutcomes?.every(outcome => outcome.hitCount === 1)).toBe(true);
    expect(humanTeam?.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Premium Runner", price: 61 }),
      expect.objectContaining({ playerName: "Value Runner", price: 39 }),
    ]));
    expect(humanTeam?.spent).toBe(100);
    expect(humanTeam?.budgetRemaining).toBe(0);
  });

  it("honors the feasible prefix of an over-capacity uncapped target plan", () => {
    const result = runTargetBudgetAuctionPlan([
      { playerName: "Premium Runner" },
      { playerName: "Value Runner" },
      { playerName: "Depth Runner 1" },
    ], "alg001-95");
    const humanTeam = result.runs[0]?.teams.find(team => team.isUserTeam);

    expect(humanTeam?.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Premium Runner", price: 58 }),
      expect.objectContaining({ playerName: "Value Runner", price: 40 }),
    ]));
    expect(humanTeam?.roster).toHaveLength(2);
    expect(new Set(humanTeam?.roster.map(player => player.playerId)).size).toBe(2);
    expect(humanTeam?.spent).toBe(98);
    expect(humanTeam?.budgetRemaining).toBe(2);
  });

  it("keeps a budget-infeasible uncapped target plan within auction invariants", () => {
    const result = runTargetBudgetAuctionPlan([
      { playerName: "Premium Runner" },
      { playerName: "Value Runner" },
    ], "alg001-95", 90);
    const humanTeam = result.runs[0]?.teams.find(team => team.isUserTeam);

    expect(humanTeam?.roster).toHaveLength(2);
    expect(humanTeam?.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Premium Runner" }),
    ]));
    expect(new Set(humanTeam?.roster.map(player => player.playerId)).size).toBe(2);
    expect(humanTeam?.spent).toBeLessThanOrEqual(90);
    expect(humanTeam?.budgetRemaining).toBeGreaterThanOrEqual(0);
  });
};
