import { describe, expect, it } from "vitest";
import { simulationSummarySchema } from "./simulationSchema";

const summary = {
  completedCount: 2,
  draftFormat: "auction",
  outcomes: [
    { favorite: false, rank: 1, runNumber: 2, userWeek1Points: 112.5 },
    { favorite: true, rank: 2, runNumber: 1, userWeek1Points: 108.1 },
  ],
  playerExposure: [],
  positionCounts: {},
  runCount: 2,
  seedPrefix: "target-outcomes",
  strategy: {
    preferredPositions: [],
    rawInput: "Draft both players",
    summary: "Two targets",
    warnings: [],
  },
};

describe("simulationSummarySchema", () => {
  it("preserves ranked and saved outcomes", () => {
    expect(simulationSummarySchema.parse(summary).outcomes).toEqual(summary.outcomes);
  });

  it("preserves current backend details for infeasible keeper targets", () => {
    const targetOutcomes = [{
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      message: "Jadarian Price is retained by Sentinels and cannot be acquired.",
      playerId: "price",
      playerName: "Jadarian Price",
      reason: "retained_by_other_team",
      status: "infeasible",
    }, {
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      message: "Puka Nacua is retained by your team for $55, above the $40 target cap.",
      playerId: "nacua",
      playerName: "Puka Nacua",
      reason: "retained_by_your_team_above_max_price",
      status: "infeasible",
    }];

    expect(simulationSummarySchema.parse({ ...summary, targetOutcomes }).targetOutcomes)
      .toEqual(targetOutcomes);
  });

  it("continues to parse legacy target outcomes", () => {
    const targetOutcome = {
      hitCount: 1,
      hitRate: 0.5,
      playerId: "price",
      playerName: "Jadarian Price",
    };

    expect(simulationSummarySchema.parse({ ...summary, targetOutcome }).targetOutcome)
      .toEqual(targetOutcome);
  });
});
