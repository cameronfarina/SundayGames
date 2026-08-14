import type { Position } from "../../../../config/league.js";
import type {
  RosterRiskCode,
  RosterStrengthCode,
  TeamAnalysisComponent,
} from "./core.js";

export interface ProjectedRosterPlayerContribution {
  playerId: string;
  playerName: string;
  position: Position;
  projectedPoints: number;
}

export interface ProjectedStarterContribution extends ProjectedRosterPlayerContribution {
  slot: string;
}

export interface StarterProjectionComponent {
  projectedPoints: number;
  filledSlots: number;
  requiredSlots: number;
  lineup: readonly ProjectedStarterContribution[];
  leagueRank: number;
  normalizedScore: number;
  weight: 0.6;
}

export interface BenchDepthComponent {
  projectedPoints: number;
  countedPlayers: number;
  availableBenchSlots: number;
  players: readonly ProjectedRosterPlayerContribution[];
  leagueRank: number;
  normalizedScore: number;
  weight: 0.25;
}

export interface PositionBalanceDetail {
  position: Position;
  actualPlayers: number;
  expectedPlayers: number;
}

export interface PositionalBalanceComponent {
  score: number;
  positions: readonly PositionBalanceDetail[];
  leagueRank: number;
  normalizedScore: number;
  weight: 0.15;
}

export interface AvailablePostDraftTeamRanking {
  status: "available";
  rank: number;
  teamCount: number;
  overallScore: number;
  components: {
    starterProjection: StarterProjectionComponent;
    benchDepth: BenchDepthComponent;
    positionalBalance: PositionalBalanceComponent;
  };
  explanation: {
    formula: "starter projection 60% + bench depth 25% + positional balance 15%";
    projectionSnapshotId: string;
    scoringSettingsId: string;
  };
}

export type TeamRankingUnavailableReasonCode =
  | "projection_coverage_incomplete"
  | "projection_scoring_settings_mismatch"
  | "projection_scoring_settings_unverified"
  | "roster_materially_incomplete";

export interface TeamRankingUnavailableReason {
  code: TeamRankingUnavailableReasonCode;
  message: string;
  projectionSnapshotId: string;
  playerIds?: readonly string[];
}

export interface UnavailablePostDraftTeamRanking {
  status: "unavailable";
  teamCount: number;
  reasons: readonly TeamRankingUnavailableReason[];
}

export type PostDraftTeamRanking = AvailablePostDraftTeamRanking | UnavailablePostDraftTeamRanking;

export interface RosterAnalysisFinding {
  code: RosterStrengthCode | RosterRiskCode;
  component: TeamAnalysisComponent;
  summary: string;
  evidence: string;
}
