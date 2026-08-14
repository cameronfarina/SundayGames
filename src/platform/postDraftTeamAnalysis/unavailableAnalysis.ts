import type { PostDraftTeamAnalysis } from "./contracts/analysis.js";
import type { AnalyzePostDraftTeamInput } from "./contracts/projections.js";
import type { TeamRankingUnavailableReason } from "./contracts/ranking.js";
import { projectionProvenance } from "./provenance.js";
import { recommendationSets } from "./recommendations/sets.js";

export const unavailableAnalysis = (
  input: AnalyzePostDraftTeamInput,
  readiness: PostDraftTeamAnalysis["recommendationReadiness"],
  reason: TeamRankingUnavailableReason,
): PostDraftTeamAnalysis => ({
  ownership: { ...input.ownership },
  generatedAt: new Date(input.evaluatedAt),
  projectionProvenance: projectionProvenance(input),
  ranking: {
    status: "unavailable",
    teamCount: input.completedDraftRoster.teams.length,
    reasons: [reason],
  },
  strengths: [],
  risks: [],
  recommendationReadiness: readiness,
  recommendations: recommendationSets(input, readiness),
});
