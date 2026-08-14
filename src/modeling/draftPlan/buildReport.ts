import type {
  BuildDraftPlanReportOptions,
  DraftPlanCandidate,
  DraftPlanReport,
} from "./contracts.js";
import { playerMarketByName } from "./players.js";
import { buildRecommendations } from "./recommendations.js";
import { buildCandidate } from "./sampledTeams/candidate.js";
import { draftPlanStrategies } from "./strategyDefinitions.js";

const defaultCandidateLimit = 5;

const rankedCandidates = (
  candidates: DraftPlanCandidate[],
): DraftPlanCandidate[] => candidates.sort(
  (left, right) =>
    right.weeks1To4Score - left.weeks1To4Score ||
    right.rbCoreSpend - left.rbCoreSpend ||
    left.budgetRemaining - right.budgetRemaining ||
    left.seed.localeCompare(right.seed),
);

export const buildDraftPlanReport = ({
  batch,
  owner,
  strategyKey,
  limit = defaultCandidateLimit,
}: BuildDraftPlanReportOptions): DraftPlanReport => {
  const strategy = draftPlanStrategies[strategyKey];
  const marketByName = playerMarketByName(batch.summary.players);
  const candidates = rankedCandidates(batch.runs.flatMap(run => {
    const roster = run.rosters.find(candidate => candidate.owner === owner);
    if (!roster) return [];
    try {
      const candidate = buildCandidate(
        run.seed,
        run.keeperScenario.key,
        roster,
        strategy,
        marketByName,
      );
      return candidate ? [candidate] : [];
    } catch {
      return [];
    }
  }));

  return {
    owner,
    strategy,
    engineMode: batch.options.diagnosticsMode === "summary" ? "fast" : "full",
    runCount: batch.runs.length,
    matchedRunCount: candidates.length,
    candidateLimit: limit,
    recommendations: buildRecommendations(candidates, batch.summary.players, strategy),
    candidates: candidates.slice(0, limit),
  };
};
