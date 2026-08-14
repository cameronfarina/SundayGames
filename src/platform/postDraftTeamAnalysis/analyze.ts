import { availableAnalysis } from "./availableAnalysis.js";
import type { PostDraftTeamAnalysis } from "./contracts/analysis.js";
import type { AnalyzePostDraftTeamInput } from "./contracts/projections.js";
import { PostDraftTeamAnalysisError } from "./errors.js";
import { rankTeams } from "./rankTeams.js";
import {
  incompleteRosterIssue,
  projectionCoverageIssue,
  projectionRankingIssue,
} from "./rankingAvailability.js";
import { initialRecommendationReadiness } from "./readiness/readiness.js";
import { componentValuesFor } from "./teamComponents.js";
import { unavailableAnalysis } from "./unavailableAnalysis.js";
import { assertAnalysisContext } from "./validation.js";

export const analyzePostDraftTeam = (input: AnalyzePostDraftTeamInput): PostDraftTeamAnalysis => {
  assertAnalysisContext(input);
  const readiness = initialRecommendationReadiness(input);
  const rankingIssue = projectionRankingIssue(input);
  if (rankingIssue !== undefined) return unavailableAnalysis(input, readiness, rankingIssue);

  const projections = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const coverageIssue = projectionCoverageIssue(input, projections);
  if (coverageIssue !== undefined) return unavailableAnalysis(input, readiness, coverageIssue);

  const teamComponents = input.completedDraftRoster.teams.map(team =>
    componentValuesFor(team, input.leagueSettings.roster, projections)
  );
  const ownedComponents = teamComponents.find(team => team.teamId === input.ownership.teamId);
  if (ownedComponents === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${input.ownership.teamId}.`,
    );
  }
  const rosterIssue = incompleteRosterIssue(input, ownedComponents);
  if (rosterIssue !== undefined) return unavailableAnalysis(input, readiness, rosterIssue);

  const rankedTeams = rankTeams(teamComponents);
  const ownedTeam = rankedTeams.find(team => team.teamId === input.ownership.teamId);
  if (ownedTeam === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${input.ownership.teamId}.`,
    );
  }
  return availableAnalysis(input, ownedTeam, rankedTeams, readiness);
};
