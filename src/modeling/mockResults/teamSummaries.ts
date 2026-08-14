import type { Owner } from "../../../config/league.js";
import { scoreText } from "./formatting.js";
import { bestValueFor, corePlayersFor, topStarterFor } from "./playerInsights.js";
import { weekOneRankByOwner } from "./rankings.js";
import type {
  MockResultsBuildSummary,
  MockResultsCamOutcome,
  MockResultsRanking,
  MockResultsTeam,
} from "./teamContracts.js";

export const applyTeamIntelligence = (
  teams: readonly MockResultsTeam[],
  rankings: readonly MockResultsRanking[],
): MockResultsTeam[] => {
  const rankingByOwner = new Map(rankings.map(ranking => [ranking.owner, ranking]));

  return teams.map(team => {
    const ranking = rankingByOwner.get(team.owner);
    if (!ranking) throw new Error(`Missing ranking for ${team.owner}.`);
    const topStarter = topStarterFor(team);
    const bestValue = bestValueFor(team);
    return {
      ...team,
      projectedRank: ranking.rank,
      projectedFinishLabel: ranking.projectedFinishLabel,
      rankExplanation: ranking.explanation,
      ...(topStarter === undefined ? {} : { topStarter }),
      ...(bestValue === undefined ? {} : { bestValue }),
      corePlayers: corePlayersFor(team),
      strengths: ranking.strengths,
      risks: ranking.risks,
    };
  });
};

export const buildSummaryFor = (
  team: MockResultsTeam,
  ranking: MockResultsRanking,
): MockResultsBuildSummary => ({
  owner: team.owner,
  rank: ranking.rank,
  headline: `${team.owner} projected ${ranking.projectedFinishLabel} with ${scoreText(team.seasonStrengthScore)} season-strength score`,
  week1Score: team.week1Score,
  weeks1To4Score: team.weeks1To4Score,
  seasonStrengthScore: team.seasonStrengthScore,
  spend: team.spend,
  budgetRemaining: team.budgetRemaining,
  corePlayers: (team.corePlayers ?? corePlayersFor(team)).map(player => player.name),
});

export const camOutcomeFor = (
  teams: readonly MockResultsTeam[],
  rankings: readonly MockResultsRanking[],
  watchOwner: Owner,
): MockResultsCamOutcome => {
  const team = teams.find(candidate => candidate.owner === watchOwner);
  const ranking = rankings.find(candidate => candidate.owner === watchOwner);
  if (!team || !ranking) throw new Error(`Missing ${watchOwner} mock result.`);

  return {
    ...buildSummaryFor(team, ranking),
    week1Rank: weekOneRankByOwner(teams).get(watchOwner) ?? ranking.rank,
    strengths: ranking.strengths,
    risks: ranking.risks,
  };
};
