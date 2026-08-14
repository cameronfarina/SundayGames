import type { PostDraftTeamAnalysis } from "../contracts/analysis.js";
import type { AnalyzePostDraftTeamInput } from "../contracts/projections.js";
import { pickupDropRecommendationRecords } from "./pickupDrop.js";
import { startSitRecommendationRecords } from "./startSit.js";

export const recommendationSets = (
  input: AnalyzePostDraftTeamInput,
  readiness: PostDraftTeamAnalysis["recommendationReadiness"],
): PostDraftTeamAnalysis["recommendations"] => ({
  startSit: {
    ...readiness.startSit,
    records: readiness.startSit.status === "ready" ? startSitRecommendationRecords(input) : [],
  },
  pickupDrop: {
    ...readiness.pickupDrop,
    records: readiness.pickupDrop.status === "ready" ? pickupDropRecommendationRecords(input) : [],
  },
});
