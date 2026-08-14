import type { Position } from "../../../../config/league.js";
import type {
  CompletedDraftRosterSnapshot,
  MyTeamOwnershipContext,
  PostDraftLeagueSettings,
  PostDraftRosterPlayer,
} from "./core.js";

export interface PostDraftProjectionSource {
  kind: "weekly_scoring_specific" | "static_fallback";
  provider: string;
  datasetId: string;
  capturedAt: string;
  confidence: "high" | "low";
  weekly: boolean;
  scoringSpecific: boolean;
}

export interface PostDraftProjectionSnapshotMetadata {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  scoringSettingsId?: string;
  generatedAt: string;
  validThrough: string;
  week?: number;
  source?: PostDraftProjectionSource;
}

export interface PostDraftProjection {
  playerId: string;
  playerName: string;
  position: Position;
  seasonProjectedPoints: number;
  weeklyProjectedPoints?: number;
}

export interface PostDraftProjectionSnapshot {
  metadata: PostDraftProjectionSnapshotMetadata;
  projections: readonly PostDraftProjection[];
}

export interface CurrentRosterSnapshotMetadata {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  teamId: string;
  privateOwnerUserId: string;
  capturedAt: string;
  validThrough: string;
  players?: readonly PostDraftRosterPlayer[];
}

export interface FreeAgentSnapshotMetadata {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  capturedAt: string;
  validThrough: string;
  players?: readonly PostDraftRosterPlayer[];
}

export interface AnalyzePostDraftTeamInput {
  ownership: MyTeamOwnershipContext;
  evaluatedAt: Date;
  currentWeek: number;
  leagueSettings: PostDraftLeagueSettings;
  completedDraftRoster: CompletedDraftRosterSnapshot;
  projectionSnapshot: PostDraftProjectionSnapshot;
  currentRosterSnapshot?: CurrentRosterSnapshotMetadata;
  freeAgentSnapshot?: FreeAgentSnapshotMetadata;
}

export interface PostDraftProjectionProvenance {
  snapshotId: string;
  scoringSettingsId?: string;
  generatedAt: string;
  validThrough: string;
  week?: number;
  source?: PostDraftProjectionSource;
}
