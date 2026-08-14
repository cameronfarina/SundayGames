import { expect, it } from "vitest";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";
import { runTargetBudgetAuctionPlan } from "./simulationFixtures.js";

export const registerTargetAvailabilityTests = (): void => {
  it("reports a target retained by another team as infeasible", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: {
        ...auctionSetup,
        initialRosters: [
          ...auctionSetup.initialRosters,
          {
            teamId: "team-2",
            playerId: "jadarian price",
            playerName: "Jadarian Price",
            position: "RB",
            price: 10,
            source: "keeper",
          },
        ],
      },
      humanTeamId: "team-1",
      runCount: 1,
      targetConstraints: [{ playerName: "Jadarian Price", maxAuctionPrice: 20 }],
      seedPrefix: "opponent-keeper-target",
    });

    expect(result.targetOutcome).toEqual({
      playerId: "jadarian price",
      playerName: "Jadarian Price",
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      reason: "retained_by_other_team",
      message: "Jadarian Price is retained by Owner12 Team and cannot be acquired. Choose another target.",
    });
    expect(result.strategy.warnings).toContain(
      "Jadarian Price is retained by Owner12 Team and cannot be acquired. Choose another target.",
    );
  });

  it("reports a retained target above the user's price cap as infeasible", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      targetConstraints: [{ playerName: "De'Von Achane", maxAuctionPrice: 20 }],
      seedPrefix: "over-cap-user-keeper-target",
    });

    expect(result.targetOutcome).toEqual({
      playerId: "devon achane",
      playerName: "De'Von Achane",
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      reason: "retained_by_your_team_above_max_price",
      message: "De'Von Achane is retained by your team for $30, above the $20 target cap. Raise the cap to at least $30 to satisfy this target.",
    });
    expect(result.strategy.warnings).toContain(
      "De'Von Achane is retained by your team for $30, above the $20 target cap. Raise the cap to at least $30 to satisfy this target.",
    );
    expect(result.playerExposure.find(player => player.playerName === "De'Von Achane"))
      .toMatchObject({ count: 1, rate: 1, averagePrice: 30 });
  });

  it("reports an available capped target acquired within the cap as a hit", () => {
    const result = runTargetBudgetAuctionPlan(
      [{ playerName: "Premium Runner", maxAuctionPrice: 61 }],
      "ordinary-capped-target-hit",
    );
    const target = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster
      .find(player => player.playerName === "Premium Runner");

    expect(target?.price).toBeLessThanOrEqual(61);
    expect(result.targetOutcome).toMatchObject({
      playerName: "Premium Runner",
      status: "hit",
      feasible: true,
      hitCount: 1,
      hitRate: 1,
    });
  });

  it("reports an available capped target not acquired within the cap as a miss", () => {
    const result = runTargetBudgetAuctionPlan(
      [{ playerName: "Premium Runner", maxAuctionPrice: 55 }],
      "ordinary-capped-target-miss",
    );
    const target = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster
      .find(player => player.playerName === "Premium Runner");

    expect(target).toBeUndefined();
    expect(result.targetOutcome).toMatchObject({
      playerName: "Premium Runner",
      status: "miss",
      feasible: true,
      hitCount: 0,
      hitRate: 0,
    });
  });
};
