import { primaryOwner } from "../../../config/league.js";
import type { MockResultsRun, MockResultsTeam } from "../mockResults.js";
import { roundToTwo } from "./math.js";

export const primaryTeamFor = (run: MockResultsRun): MockResultsTeam => {
  const primaryTeam = run.teams.find(team => team.owner === primaryOwner);
  if (!primaryTeam) throw new Error(`Missing primary team for ${run.label}.`);
  return primaryTeam;
};

export const benchWeek1ScoreFor = (run: MockResultsRun): number =>
  roundToTwo(
    primaryTeamFor(run).bench
      .filter(player => player.position !== "K" && player.position !== "DST")
      .sort(
        (left, right) =>
          right.week1 - left.week1
          || right.weeks1To4 - left.weeks1To4
          || left.name.localeCompare(right.name),
      )
      .slice(0, 3)
      .reduce((total, player) => total + player.week1, 0),
  );

export const starterFloorWeek1ScoreFor = (run: MockResultsRun): number =>
  roundToTwo(Math.min(...primaryTeamFor(run).starters.map(player => player.week1)));

export const dollarPlayerCountFor = (run: MockResultsRun): number =>
  primaryTeamFor(run).players.filter(player => player.price <= 2).length;

export const thinnessScoreFor = (run: MockResultsRun): number => {
  const benchWeek1Score = benchWeek1ScoreFor(run);
  const starterFloorWeek1Score = starterFloorWeek1ScoreFor(run);
  const dollarPlayers = dollarPlayerCountFor(run);
  const lowBenchPenalty = Math.max(0, 18 - benchWeek1Score) * 1.5;
  const lowStarterPenalty = Math.max(0, 8.5 - starterFloorWeek1Score) * 4;

  return roundToTwo(lowBenchPenalty + lowStarterPenalty + dollarPlayers * 1.25);
};
