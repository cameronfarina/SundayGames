import type { DraftPlanReport } from "../draftPlan.js";
import type { DraftReadyTopCandidate } from "./contracts.js";

export const topCandidateFor = (
  report: DraftPlanReport,
): DraftReadyTopCandidate | undefined => {
  const candidate = report.candidates[0];
  if (candidate === undefined) return undefined;
  return {
    seed: candidate.seed,
    rosterSpend: candidate.rosterSpend,
    budgetRemaining: candidate.budgetRemaining,
    weeks1To4Score: candidate.weeks1To4Score,
    rbCoreSpend: candidate.rbCoreSpend,
    rbCore: candidate.rbCore.map(player => `${player.name} $${player.price}`),
  };
};
