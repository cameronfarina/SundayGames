import type { AnalyzePostDraftTeamInput } from "../contracts/projections.js";
import type { RecommendationReadinessReason } from "../contracts/recommendations.js";

export const currentRosterReadinessReasons = (
  input: AnalyzePostDraftTeamInput,
): RecommendationReadinessReason[] => {
  const snapshot = input.currentRosterSnapshot;
  if (snapshot === undefined) {
    return [{
      code: "current_roster_snapshot_missing",
      input: "currentRoster",
      message: "A current roster snapshot is required for start/sit and pickup/drop advice.",
    }];
  }
  if (new Date(snapshot.validThrough) < input.evaluatedAt) {
    return [{
      code: "current_roster_snapshot_stale",
      input: "currentRoster",
      message: `Current roster state expired at ${snapshot.validThrough}.`,
      snapshotId: snapshot.snapshotId,
    }];
  }
  if (snapshot.players === undefined) {
    return [{
      code: "current_roster_players_missing",
      input: "currentRoster",
      message: "Current roster state does not include the players required for coach advice.",
      snapshotId: snapshot.snapshotId,
    }];
  }
  return [];
};
