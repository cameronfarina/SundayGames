import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { ExplicitLeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";
import type {
  SeasonSimulationPreferenceOutcome,
  SeasonSimulationPreferredPosition,
} from "../seasonSimulationPreferences.js";
import type {
  SeasonSimulationTargetConstraint,
  SeasonSimulationTargetOutcome,
} from "../seasonSimulationTargets.js";

export interface SeasonSimulationPositionCap {
  position: "QB" | "RB" | "WR" | "TE";
  maxAuctionPrice: number;
  excludeNamedTargets: boolean;
}

export interface ParsedSeasonSimulationStrategy {
  rawInput: string;
  targets?: readonly SeasonSimulationTargetConstraint[] | undefined;
  target?: SeasonSimulationTargetConstraint | undefined;
  preferredPositions: readonly SeasonSimulationPreferredPosition[];
  positionCaps?: readonly SeasonSimulationPositionCap[] | undefined;
  pairWithPlayerName?: string | undefined;
  summary: string;
  warnings: readonly string[];
}

export type SeasonSimulationErrorCode =
  | "human_team_missing"
  | "invalid_configuration"
  | "invalid_request_id"
  | "invalid_run_count"
  | "invalid_seed_prefix"
  | "simulation_account_queue_full"
  | "simulation_busy"
  | "simulation_canceled"
  | "simulation_failed"
  | "simulation_worker_unavailable"
  | "simulation_timeout";

export const maximumSeasonSimulationRunCount = 100;

export class SeasonSimulationError extends Error {
  constructor(
    readonly code: SeasonSimulationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonSimulationError";
  }
}

export interface RunSeasonSimulationsInput {
  season: ExplicitLeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  runCount: number;
  strategyInput?: string | undefined;
  targetConstraints?: readonly SeasonSimulationTargetConstraint[] | undefined;
  seedPrefix?: string | undefined;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
  playerHumanValues?: Readonly<Record<string, number>> | undefined;
  week1Projections?: Readonly<Record<string, number>> | undefined;
  historicalSaleRecords?: readonly HistoricalSaleRecord[] | undefined;
}

export interface SeasonSimulationProgress {
  completed: number;
  total: number;
}

export interface RunSeasonSimulationsOptions {
  onProgress?: ((progress: SeasonSimulationProgress) => void) | undefined;
}

export interface SeasonSimulationPlayerExposure {
  playerId: string;
  playerName: string;
  position: string;
  count: number;
  rate: number;
  averagePrice?: number | undefined;
  averagePick?: number | undefined;
}

export interface SeasonSimulationPositionCount {
  total: number;
  perRun: number;
}

export interface SeasonSimulationRosterPlayer {
  playerId: string;
  playerName: string;
  position: string;
  source: "ai" | "human" | "keeper";
  price?: number | undefined;
  overallPick?: number | undefined;
  round?: number | undefined;
  rosterSlot: string;
  starter: boolean;
  week1Points: number;
}

export interface SeasonSimulationTeamResult {
  teamId: string;
  teamName: string;
  isUserTeam: boolean;
  roster: readonly SeasonSimulationRosterPlayer[];
  week1Points: number;
  spent?: number | undefined;
  budgetRemaining?: number | undefined;
}

export interface SeasonSimulationRunResult {
  runNumber: number;
  label: string;
  seed: string;
  teams: readonly SeasonSimulationTeamResult[];
}

export interface SeasonSimulationResult {
  draftFormat: "auction" | "snake";
  runCount: number;
  completedCount: number;
  seedPrefix: string;
  strategy: ParsedSeasonSimulationStrategy;
  targetOutcomes?: readonly SeasonSimulationTargetOutcome[] | undefined;
  targetOutcome?: SeasonSimulationTargetOutcome | undefined;
  preferenceOutcomes?: readonly SeasonSimulationPreferenceOutcome[] | undefined;
  playerExposure: readonly SeasonSimulationPlayerExposure[];
  positionCounts: Readonly<Record<string, SeasonSimulationPositionCount>>;
  runs: readonly SeasonSimulationRunResult[];
}

export interface CompletedSimulationRun {
  runNumber: number;
  seed: string;
  teams: readonly SeasonSimulationTeamResult[];
}
