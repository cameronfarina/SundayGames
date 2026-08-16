import { describe, expect, it } from "vitest";
import type { SeasonSimulationResult } from "./seasonSimulationEngine.js";
import { summarizeSeasonSimulation } from "./seasonSimulationHttpContract.js";

const userTeam = (week1Points: number) => ({
  teamId: "team-user",
  teamName: "Short King",
  isUserTeam: true,
  roster: [],
  week1Points,
});

const simulation = (): SeasonSimulationResult => ({
  draftFormat: "auction",
  runCount: 3,
  completedCount: 3,
  seedPrefix: "ranked-outcomes",
  strategy: {
    rawInput: "",
    preferredPositions: [],
    summary: "Balanced draft",
    warnings: [],
  },
  playerExposure: [],
  positionCounts: {},
  runs: [
    { runNumber: 1, label: "Run 1", seed: "one", teams: [userTeam(104.2)] },
    { runNumber: 2, label: "Run 2", seed: "two", teams: [userTeam(111.8)] },
    { runNumber: 3, label: "Run 3", seed: "three", teams: [userTeam(108.5)] },
  ],
});

describe("season simulation HTTP contract", () => {
  it("ranks outcomes by the user's projected Week 1 score", () => {
    expect(summarizeSeasonSimulation(simulation(), [3]).outcomes).toEqual([
      { favorite: false, rank: 1, runNumber: 2, userWeek1Points: 111.8 },
      { favorite: true, rank: 2, runNumber: 3, userWeek1Points: 108.5 },
      { favorite: false, rank: 3, runNumber: 1, userWeek1Points: 104.2 },
    ]);
  });
});
