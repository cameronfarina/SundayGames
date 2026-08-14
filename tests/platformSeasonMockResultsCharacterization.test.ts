import { describe, expect, it } from "vitest";
import { createGenericAuctionMockState } from "../src/platform/genericAuctionMockEngine.js";
import { buildSeasonMockResults } from "../src/platform/seasonMockResults.js";

describe("season mock results characterization", () => {
  it("builds a ranked team grid with the best legal starters and auction metadata", () => {
    const players = [
      { id: "alpha-rb", name: "Alpha RB", position: "RB", expectedPrice: 9, week1Projection: 20.04 },
      { id: "alpha-wr", name: "Alpha WR", position: "WR", expectedPrice: 8, week1Projection: 15.04 },
      { id: "alpha-bench", name: "Alpha Bench", position: "WR", expectedPrice: 1, week1Projection: 2 },
      { id: "beta-rb", name: "Beta RB", position: "RB", expectedPrice: 6, week1Projection: 10 },
      { id: "beta-wr", name: "Beta WR", position: "WR", expectedPrice: 5, week1Projection: 9 },
      { id: "beta-bench", name: "Beta Bench", position: "WR", expectedPrice: 1 },
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `available-${index}`,
        name: `Available ${index}`,
        position: index % 2 === 0 ? "RB" : "WR",
        expectedPrice: 1,
        week1Projection: 0,
      })),
    ];
    const state = createGenericAuctionMockState({
      sessionId: "characterization",
      seed: "characterization",
      humanTeamId: "alpha",
      budgetDollars: 100,
      minimumBidDollars: 1,
      teams: [
        { id: "beta", name: "Beta" },
        { id: "alpha", name: "Alpha" },
        { id: "gamma", name: "Gamma" },
        { id: "delta", name: "Delta" },
      ],
      rosterSlots: [
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["RB", "WR"] },
      ],
      positionMaximums: { RB: 2, WR: 3 },
      players,
      keepers: [
        { teamId: "alpha", playerId: "alpha-bench", price: 1 },
        { teamId: "alpha", playerId: "alpha-rb", price: 9 },
        { teamId: "alpha", playerId: "alpha-wr", price: 8 },
        { teamId: "beta", playerId: "beta-rb", price: 6 },
        { teamId: "beta", playerId: "beta-wr", price: 5 },
        { teamId: "beta", playerId: "beta-bench", price: 1 },
      ],
    });

    const results = buildSeasonMockResults(state);

    expect(results.projectedPlayerCount).toBe(5);
    expect(results.rosteredPlayerCount).toBe(6);
    expect(results.teams.map(team => [team.teamName, team.rank, team.week1Points])).toEqual([
      ["Alpha", 1, 35.1],
      ["Beta", 2, 19],
      ["Delta", 3, 0],
      ["Gamma", 4, 0],
    ]);
    expect(results.teams[0]).toMatchObject({
      isUserTeam: true,
      spent: 18,
      budgetRemaining: 82,
      roster: [
        { playerId: "alpha-rb", rosterSlot: "RB", starter: true, source: "keeper", price: 9 },
        { playerId: "alpha-wr", rosterSlot: "FLEX", starter: true, source: "keeper", price: 8 },
        { playerId: "alpha-bench", rosterSlot: "BENCH", starter: false, source: "keeper", price: 1 },
      ],
    });
  });
});
