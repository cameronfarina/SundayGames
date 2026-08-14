import type { AnalyzePostDraftTeamInput, PostDraftProjection } from "../contracts/projections.js";
import type { RecommendationReadinessReason } from "../contracts/recommendations.js";

const missingWeeklyProjectionIds = (
  players: readonly { playerId: string }[],
  projections: ReadonlyMap<string, PostDraftProjection>,
): string[] => players
  .filter(player => !Number.isFinite(projections.get(player.playerId)?.weeklyProjectedPoints))
  .map(player => player.playerId);

export const pickupDropReadinessReasons = (
  input: AnalyzePostDraftTeamInput,
  projections: ReadonlyMap<string, PostDraftProjection>,
): RecommendationReadinessReason[] => {
  const reasons: RecommendationReadinessReason[] = [];
  const currentRoster = input.currentRosterSnapshot;
  if (
    currentRoster !== undefined &&
    new Date(currentRoster.validThrough) >= input.evaluatedAt &&
    currentRoster.players !== undefined
  ) {
    const missingPlayerIds = missingWeeklyProjectionIds(currentRoster.players, projections);
    if (missingPlayerIds.length > 0) {
      reasons.push({
        code: "current_roster_projection_coverage_incomplete",
        input: "weeklyProjections",
        message: "Weekly projections do not cover every player on the current roster.",
        snapshotId: input.projectionSnapshot.metadata.snapshotId,
        playerIds: missingPlayerIds,
      });
    }
  }

  const freeAgents = input.freeAgentSnapshot;
  if (freeAgents === undefined) {
    reasons.push({
      code: "free_agent_snapshot_missing",
      input: "freeAgents",
      message: "A current free-agent snapshot is required for pickup/drop advice.",
    });
  } else if (new Date(freeAgents.validThrough) < input.evaluatedAt) {
    reasons.push({
      code: "free_agent_snapshot_stale",
      input: "freeAgents",
      message: `Free-agent state expired at ${freeAgents.validThrough}.`,
      snapshotId: freeAgents.snapshotId,
    });
  } else if (freeAgents.players === undefined) {
    reasons.push({
      code: "free_agent_players_missing",
      input: "freeAgents",
      message: "Free-agent state does not include the players required for pickup/drop advice.",
      snapshotId: freeAgents.snapshotId,
    });
  } else {
    const missingPlayerIds = missingWeeklyProjectionIds(freeAgents.players, projections);
    if (missingPlayerIds.length > 0) {
      reasons.push({
        code: "free_agent_projection_coverage_incomplete",
        input: "weeklyProjections",
        message: "Weekly projections do not cover every available free agent.",
        snapshotId: input.projectionSnapshot.metadata.snapshotId,
        playerIds: missingPlayerIds,
      });
    }
  }
  return reasons;
};
