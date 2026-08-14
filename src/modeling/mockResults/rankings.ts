import type { Owner } from "../../../config/league.js";
import { moneyText, ordinal, roundToTwo, scoreText } from "./formatting.js";
import { bestValueFor, topStarterFor } from "./playerInsights.js";
import type { MockResultsRanking, MockResultsTeam } from "./teamContracts.js";

const baseRankingTeams = (teams: readonly MockResultsTeam[]): MockResultsTeam[] =>
  [...teams].sort(
    (left, right) =>
      right.seasonStrengthScore - left.seasonStrengthScore ||
      right.weeks1To4Score - left.weeks1To4Score ||
      right.week1Score - left.week1Score ||
      left.owner.localeCompare(right.owner),
  );

export const weekOneRankByOwner = (teams: readonly MockResultsTeam[]): Map<Owner, number> =>
  new Map([...teams]
    .sort(
      (left, right) =>
        right.week1Score - left.week1Score ||
        right.weeks1To4Score - left.weeks1To4Score ||
        left.owner.localeCompare(right.owner),
    )
    .map((team, index) => [team.owner, index + 1]));

const strengthNotesFor = (team: MockResultsTeam, week1Rank: number): string[] => {
  const topStarter = topStarterFor(team);
  const bestValue = bestValueFor(team);
  const notes = [`Week 1 rank ${ordinal(week1Rank)}`];

  if (topStarter) notes.push(`Top starter ${topStarter.name} at ${scoreText(topStarter.week1)} W1`);
  notes.push(`Season strength ${scoreText(team.seasonStrengthScore)}`);
  notes.push(`Depth ${scoreText(team.depthScore)} / consistency ${scoreText(team.consistencyScore)}`);
  if (bestValue) notes.push(`Best value ${bestValue.name} at ${moneyText(bestValue.price)}`);
  return notes;
};

const riskNotesFor = (team: MockResultsTeam, rank: number, leaderScore: number): string[] => {
  const risks: string[] = [];
  const leaderGap = roundToTwo(leaderScore - team.seasonStrengthScore);
  if (rank > 7) risks.push(`Needs ${scoreText(leaderGap)} points of upside to catch the lead`);
  if (team.budgetRemaining <= 1) risks.push("No budget cushion after the draft");
  if (!team.valid) risks.push(team.errors[0] ?? "Roster validation warning");
  return risks.length ? risks : ["No major roster-shape warning in this run"];
};

export const rankingsFor = (teams: readonly MockResultsTeam[]): MockResultsRanking[] => {
  const rankedTeams = baseRankingTeams(teams);
  const week1Ranks = weekOneRankByOwner(teams);
  const leaderScore = rankedTeams[0]?.seasonStrengthScore ?? 0;
  const runnerUp = rankedTeams[1];

  return rankedTeams.map((team, index) => {
    const rank = index + 1;
    const week1Rank = week1Ranks.get(team.owner) ?? rank;
    const gapToLeader = roundToTwo(leaderScore - team.seasonStrengthScore);
    const margin = rank === 1 && runnerUp
      ? roundToTwo(team.seasonStrengthScore - runnerUp.seasonStrengthScore)
      : gapToLeader;
    const explanation = rank === 1
      ? `Projected 1st by season strength, ${scoreText(margin)} ahead of the field; Week 1 rank ${ordinal(week1Rank)}.`
      : `Projected ${ordinal(rank)} by season strength, ${scoreText(gapToLeader)} behind the leader; Week 1 rank ${ordinal(week1Rank)}.`;

    return {
      rank,
      owner: team.owner,
      week1Score: team.week1Score,
      weeks1To4Score: team.weeks1To4Score,
      week1Rank,
      starterSeasonScore: team.starterSeasonScore,
      depthScore: team.depthScore,
      consistencyScore: team.consistencyScore,
      seasonStrengthScore: team.seasonStrengthScore,
      projectedFinishScore: team.seasonStrengthScore,
      projectedFinishLabel: ordinal(rank),
      explanation,
      strengths: strengthNotesFor(team, week1Rank),
      risks: riskNotesFor(team, rank, leaderScore),
    };
  });
};
