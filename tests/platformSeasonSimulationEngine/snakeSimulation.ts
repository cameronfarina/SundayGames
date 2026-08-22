import { expect, it } from "vitest";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { snakeSetup } from "./draftSetups.js";
import { snakeSeason } from "./leagueFixtures.js";

export const registerSnakeSimulationTests = (): void => {
  it("respects the claimed team's draft slot when an earlier team takes a target", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: { ...snakeSetup, initialRosters: [] },
      humanTeamId: "team-4",
      runCount: 1,
      targetConstraints: [{ playerName: "De'Von Achane" }],
      seedPrefix: "fourth-pick-unavailable-target",
    });
    const humanRoster = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster ?? [];

    expect(humanRoster[0]).toMatchObject({ overallPick: 4, source: "human" });
    expect(humanRoster).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "De'Von Achane" }),
    ]));
    expect(result.targetOutcome).toMatchObject({
      playerName: "De'Von Achane",
      status: "miss",
      hitCount: 0,
    });
  });

  it("keeps a snake deadline entered for an already-saved target", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Target Receiver by round 1",
      targetConstraints: [{ playerName: "Target Receiver" }],
      seedPrefix: "saved-target-round-deadline",
    });

    expect(result.strategy.target).toMatchObject({
      playerName: "Target Receiver",
      maxSnakeRound: 1,
    });
  });

  it("completes deterministic snake runs with a round deadline and pick exposure", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Draft Target Receiver no later than round 2 to pair with De'Von Achane",
      seedPrefix: "snake-plan",
    });

    expect(result).toMatchObject({
      draftFormat: "snake",
      runCount: 2,
      completedCount: 2,
      targetOutcome: {
        playerName: "Target Receiver",
        hitCount: 2,
        hitRate: 1,
      },
      positionCounts: {
        RB: { total: 2, perRun: 1 },
        WR: { total: 2, perRun: 1 },
      },
    });
    expect(result.playerExposure.find(player => player.playerName === "Target Receiver"))
      .toMatchObject({ count: 2, rate: 1, averagePick: 1 });
    expect(result.runs).toHaveLength(2);
    expect(result.runs[0]?.teams).toHaveLength(4);
    expect(result.runs[0]?.teams.find(team => team.teamId === "team-1")?.roster).toEqual([
      expect.objectContaining({ playerName: "De'Von Achane", source: "keeper", round: 2 }),
      expect.objectContaining({ playerName: "Target Receiver", source: "human", overallPick: 1 }),
    ]);
  });

  it("enforces and reports the league-relative snake elite tier", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Target an elite WR",
      seedPrefix: "snake-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "WR",
      tier: "elite",
      targetCount: 1,
      status: "hit",
      feasible: true,
      hitCount: 2,
      hitRate: 1,
      rule: {
        basis: "snake_catalog_rank",
        positionRankMaximum: 1,
        qualifyingPlayerIds: ["target receiver"],
      },
    })]);
    expect(result.runs[0]?.teams.find(team => team.teamId === "team-1")?.roster).toEqual([
      expect.objectContaining({ playerName: "De'Von Achane", source: "keeper" }),
      expect.objectContaining({ playerName: "Target Receiver", source: "human" }),
    ]);
  });
};
