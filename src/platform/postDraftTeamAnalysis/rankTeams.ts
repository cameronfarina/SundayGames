import { balanceWeight, benchWeight, starterWeight } from "./constants.js";
import type { RankedTeam, TeamComponentValues } from "./internalTypes.js";
import { round } from "./numbers.js";
import { normalizedScoresFor, ranksFor } from "./ranks.js";

export const rankTeams = (teams: readonly TeamComponentValues[]): RankedTeam[] => {
  const starterRanks = ranksFor(teams, team => team.starterProjectedPoints);
  const benchRanks = ranksFor(teams, team => team.benchProjectedPoints);
  const balanceRanks = ranksFor(teams, team => team.positionalBalanceScore);
  const starterScores = normalizedScoresFor(teams, team => team.starterProjectedPoints);
  const benchScores = normalizedScoresFor(teams, team => team.benchProjectedPoints);
  const balanceScores = normalizedScoresFor(teams, team => team.positionalBalanceScore);
  const withScores = teams.map(team => {
    const starterNormalizedScore = starterScores.get(team.teamId) ?? 0;
    const benchNormalizedScore = benchScores.get(team.teamId) ?? 0;
    const balanceNormalizedScore = balanceScores.get(team.teamId) ?? 0;
    return {
      ...team,
      starterRank: starterRanks.get(team.teamId) ?? teams.length,
      starterNormalizedScore,
      benchRank: benchRanks.get(team.teamId) ?? teams.length,
      benchNormalizedScore,
      balanceRank: balanceRanks.get(team.teamId) ?? teams.length,
      balanceNormalizedScore,
      overallScore: round(
        starterNormalizedScore * starterWeight +
        benchNormalizedScore * benchWeight +
        balanceNormalizedScore * balanceWeight,
      ),
    };
  });
  const overallRanks = ranksFor(withScores, team => team.overallScore);
  return withScores.map(team => ({
    ...team,
    overallRank: overallRanks.get(team.teamId) ?? teams.length,
  }));
};
