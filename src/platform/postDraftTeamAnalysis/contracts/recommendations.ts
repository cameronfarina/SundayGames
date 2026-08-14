import type { Position } from "../../../../config/league.js";

export type RecommendationReadinessStatus = "ready" | "stale" | "unavailable";
export type RecommendationInput = "currentRoster" | "freeAgents" | "weeklyProjections";
export type RecommendationReadinessReasonCode =
  | "current_roster_snapshot_missing"
  | "current_roster_snapshot_stale"
  | "current_roster_players_missing"
  | "current_roster_projection_coverage_incomplete"
  | "free_agent_snapshot_missing"
  | "free_agent_snapshot_stale"
  | "free_agent_players_missing"
  | "free_agent_projection_coverage_incomplete"
  | "projection_scoring_settings_mismatch"
  | "projection_scoring_settings_unverified"
  | "weekly_projection_coverage_incomplete"
  | "weekly_projection_source_unverified"
  | "weekly_projections_stale"
  | "weekly_projections_wrong_week";

export interface RecommendationReadinessReason {
  code: RecommendationReadinessReasonCode;
  input: RecommendationInput;
  message: string;
  snapshotId?: string;
  playerIds?: readonly string[];
}

export interface CoachRecommendationReadiness {
  status: RecommendationReadinessStatus;
  reasons: readonly RecommendationReadinessReason[];
  snapshotIds: readonly string[];
}

export interface CoachProjectedPlayer {
  playerId: string;
  playerName: string;
  position: Position;
  projectedPoints: number;
}

export interface StartSitRecommendationRecord {
  recommendationId: string;
  slot: string;
  start: CoachProjectedPlayer;
  sit?: CoachProjectedPlayer;
  projectedPointEdge?: number;
  explanation: string;
}

export interface PickupDropRecommendationRecord {
  recommendationId: string;
  add: CoachProjectedPlayer;
  drop: CoachProjectedPlayer;
  projectedPointGain: number;
  explanation: string;
}

export interface CoachRecommendationSet<Recommendation> extends CoachRecommendationReadiness {
  records: readonly Recommendation[];
}
