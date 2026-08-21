import { describe, expect, it } from "vitest";

import { runTargetPlanFixture } from "./support/seasonTargetPlanFixture.js";

describe("season simulation target-plan feasibility", () => {
  it.each([
    "target-plan-adversarial-alpha",
    "target-plan-adversarial-beta",
    "target-plan-adversarial-gamma",
  ])("acquires every jointly affordable uncapped target for seed %s", seedPrefix => {
    const result = runTargetPlanFixture({
      targets: [
        { playerName: "Premium Runner" },
        { playerName: "Value Runner" },
      ],
      runCount: 25,
      seedPrefix,
    });

    expect(result.targetOutcomes).toEqual([
      expect.objectContaining({ status: "hit", feasible: true, hitCount: 25, hitRate: 1 }),
      expect.objectContaining({ status: "hit", feasible: true, hitCount: 25, hitRate: 1 }),
    ]);
    expect(result.runs.every(run => run.seed.startsWith(seedPrefix))).toBe(true);
    expect(result.runs.flatMap(run => run.teams)
      .filter(team => team.isUserTeam)
      .every(team => team.roster
        .filter(player => player.source === "human")
        .map(player => player.playerName)
        .join(",") === "Premium Runner,Value Runner"))
      .toBe(true);
  });

  it("does not report a random miss for the original target-budget regression", () => {
    const result = runTargetPlanFixture({
      targets: [
        { playerName: "Premium Runner" },
        { playerName: "Value Runner" },
      ],
    });

    expect(result.targetOutcomes?.[1]).toMatchObject({
      playerName: "Value Runner",
      status: "hit",
      feasible: true,
      hitCount: 1,
      hitRate: 1,
    });
  });

  it("marks a lower-priority target infeasible when no roster slot remains", () => {
    const result = runTargetPlanFixture({
      targets: [
        { playerName: "Premium Runner" },
        { playerName: "Value Runner" },
        { playerName: "Depth Runner 1" },
      ],
      budgetDollars: 110,
    });

    expect(result.targetOutcomes?.map(outcome => ({
      playerName: outcome.playerName,
      status: outcome.status,
      reason: outcome.reason,
    }))).toEqual([
      { playerName: "Premium Runner", status: "hit", reason: undefined },
      { playerName: "Value Runner", status: "hit", reason: undefined },
      {
        playerName: "Depth Runner 1",
        status: "infeasible",
        reason: "insufficient_roster_slots",
      },
    ]);
  });

  it("marks a lower-priority target infeasible when its modeled cost breaks reserves", () => {
    const result = runTargetPlanFixture({
      targets: [
        { playerName: "Premium Runner" },
        { playerName: "Value Runner" },
      ],
      // Rivals stop at 40% of the budget now, so the premium target's
      // modeled cost shrinks with the budget; 64 recreates the squeeze.
      budgetDollars: 64,
    });

    expect(result.targetOutcomes?.[1]).toMatchObject({
      playerName: "Value Runner",
      status: "infeasible",
      feasible: false,
      reason: "insufficient_auction_budget",
      hitCount: 0,
      hitRate: 0,
    });
  });

  it("keeps an ordinary capped target feasible when the cap may cause a miss", () => {
    // 150 keeps the rivals' 40% single-bid cap ($60) above this manager's
    // $55 limit, so the market can still clear past it.
    const result = runTargetPlanFixture({
      targets: [{ playerName: "Premium Runner", maxAuctionPrice: 55 }],
      budgetDollars: 150,
    });

    expect(result.targetOutcome).toMatchObject({
      playerName: "Premium Runner",
      status: "miss",
      feasible: true,
    });
  });
});
