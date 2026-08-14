import { lineupScore, optimizeLineup, playerMetricValue } from "../../lineupOptimizer.js";
import type { LineupEntry } from "../../types.js";
import type { MockRosterSummary } from "../mockBatch.js";
import { roundToTwo } from "./formatting.js";
import {
  benchPlayersFor,
  optimizedWeekOneLineup,
  seasonLineupFor,
  starterResultFor,
} from "./playerLineups.js";
import type { MockResultsTeam } from "./teamContracts.js";

const depthScoreFor = (
  roster: MockRosterSummary,
  seasonLineup: readonly LineupEntry[],
): number => {
  const starterNames = new Set(seasonLineup.map(entry => entry.player.name));
  const weights: readonly number[] = [0.16, 0.12, 0.09, 0.06, 0.04];
  const depthPlayers = roster.players
    .filter(player => !starterNames.has(player.name))
    .filter(player => player.position !== "K" && player.position !== "DST")
    .sort(
      (left, right) =>
        playerMetricValue(right, "seasonProjection") - playerMetricValue(left, "seasonProjection") ||
        right.week1 - left.week1 ||
        left.name.localeCompare(right.name),
    )
    .slice(0, weights.length);

  return roundToTwo(depthPlayers.reduce(
    (total, player, index) => total + playerMetricValue(player, "seasonProjection") * (weights[index] ?? 0),
    0,
  ));
};

const consistencyScoreFor = (seasonLineup: readonly LineupEntry[]): number =>
  roundToTwo(seasonLineup.reduce((total, entry) => {
    const weekOnePace = entry.player.week1 * 17;
    const seasonProjection = playerMetricValue(entry.player, "seasonProjection");
    const strongerProjection = Math.max(weekOnePace, seasonProjection, 1);
    const steadiness = Math.min(weekOnePace, seasonProjection) / strongerProjection;
    return total + steadiness * 1.5;
  }, 0));

export const teamResultFor = (roster: MockRosterSummary): MockResultsTeam => {
  const starters = optimizedWeekOneLineup(roster);
  const seasonLineup = seasonLineupFor(roster);
  const weeksOneToFourLineup = optimizeLineup(
    { strategy: "mock-results-weeks-1-4", players: roster.players },
    "weeks1To4",
  );
  const starterPlayers = starters.map(starterResultFor);
  const bench = benchPlayersFor(roster, starters);
  const weeks1To4Score = roundToTwo(
    roster.weeks1To4Score ?? lineupScore(weeksOneToFourLineup, "weeks1To4"),
  );
  const starterSeasonScore = roundToTwo(lineupScore(seasonLineup, "seasonProjection"));
  const depthScore = depthScoreFor(roster, seasonLineup);
  const consistencyScore = consistencyScoreFor(seasonLineup);

  return {
    owner: roster.owner,
    spend: roster.spend,
    budgetRemaining: roster.budgetRemaining,
    week1Score: roundToTwo(lineupScore(starters, "week1")),
    weeks1To4Score,
    starterSeasonScore,
    depthScore,
    consistencyScore,
    seasonStrengthScore: roundToTwo(starterSeasonScore + depthScore + consistencyScore),
    valid: roster.valid,
    errors: roster.errors,
    starters: starterPlayers,
    bench,
    players: [...starterPlayers, ...bench],
  };
};
