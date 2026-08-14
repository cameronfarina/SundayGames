import type {
  RecommendationReadinessReason,
  RecommendationReadinessReasonCode,
  RecommendationReadinessStatus,
} from "../contracts/recommendations.js";

const staleReasonCodes = new Set<RecommendationReadinessReasonCode>([
  "current_roster_snapshot_stale",
  "free_agent_snapshot_stale",
  "weekly_projections_stale",
]);

export const readinessStatusFor = (
  reasons: readonly RecommendationReadinessReason[],
): RecommendationReadinessStatus => {
  if (reasons.length === 0) return "ready";
  if (reasons.every(reason => staleReasonCodes.has(reason.code))) return "stale";
  return "unavailable";
};
