import type { AnalyzePostDraftTeamInput } from "../contracts/projections.js";
import type { RecommendationReadinessReason } from "../contracts/recommendations.js";

export const projectionReadinessReasons = (
  input: AnalyzePostDraftTeamInput,
  playersWithoutWeeklyProjections: readonly string[],
): RecommendationReadinessReason[] => {
  const metadata = input.projectionSnapshot.metadata;
  const snapshotId = metadata.snapshotId;
  const reasons: RecommendationReadinessReason[] = [];
  if (
    metadata.source !== undefined &&
    (
      metadata.source.kind !== "weekly_scoring_specific" ||
      !metadata.source.weekly ||
      !metadata.source.scoringSpecific ||
      metadata.source.confidence !== "high"
    )
  ) {
    reasons.push({
      code: "weekly_projection_source_unverified",
      input: "weeklyProjections",
      message: `Static ${metadata.source.provider} fallback data is not a current, league-scoring-specific weekly projection source.`,
      snapshotId,
    });
  }
  if (metadata.scoringSettingsId === undefined) {
    reasons.push({
      code: "projection_scoring_settings_unverified",
      input: "weeklyProjections",
      message: `Projection snapshot ${snapshotId} was not calculated for this league's scoring settings.`,
      snapshotId,
    });
  } else if (metadata.scoringSettingsId !== input.leagueSettings.scoring.id) {
    reasons.push({
      code: "projection_scoring_settings_mismatch",
      input: "weeklyProjections",
      message: `Projection snapshot ${snapshotId} uses ${metadata.scoringSettingsId}, not ${input.leagueSettings.scoring.id}.`,
      snapshotId,
    });
  }
  if (metadata.week !== input.currentWeek) {
    reasons.push({
      code: "weekly_projections_wrong_week",
      input: "weeklyProjections",
      message: `Weekly projections are for week ${metadata.week ?? "unknown"}, not week ${input.currentWeek}.`,
      snapshotId,
    });
  }
  if (playersWithoutWeeklyProjections.length > 0) {
    reasons.push({
      code: "weekly_projection_coverage_incomplete",
      input: "weeklyProjections",
      message: "Weekly projections do not cover every player on the owned roster.",
      snapshotId,
      playerIds: playersWithoutWeeklyProjections,
    });
  }
  if (new Date(metadata.validThrough) < input.evaluatedAt) {
    reasons.push({
      code: "weekly_projections_stale",
      input: "weeklyProjections",
      message: `Weekly projections expired at ${metadata.validThrough}.`,
      snapshotId,
    });
  }
  return reasons;
};
