import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { Owner, Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../projections.js";
import type { MockRoster } from "../../types.js";
import type {
  AuctionBudgetTrajectoryRow,
  AuctionDiagnosticsMode,
  AuctionEngineConfigOverrides,
  AuctionPick,
} from "../auctionEngine.js";
import type { PricingConfig } from "../basePricing.js";
import type { KeeperScenario, KeeperScenarioKey } from "../keeperInflation.js";

export type PositionAmounts = Record<Position, number>;

export interface ForcedAuctionSale {
  owner: Owner;
  player: string;
  price: number;
}

export interface RunMockOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  seed?: string;
  pricingConfig?: PricingConfig;
  auctionConfigOverrides?: AuctionEngineConfigOverrides;
  forcedSales?: readonly ForcedAuctionSale[];
  diagnosticsMode?: AuctionDiagnosticsMode;
}

export interface RunMockBatchOptions extends Omit<RunMockOptions, "scenarioKey" | "seed"> {
  scenarioKeys?: readonly KeeperScenarioKey[];
  runsPerScenario?: number;
  seedPrefix?: string;
}

export interface RunMockBatchProgress {
  run: MockRun;
  completedRuns: number;
  totalRuns: number;
}

export interface RunMockBatchRunContext {
  scenarioKey: KeeperScenarioKey;
  runIndex: number;
  completedRuns: number;
  seed: string;
}

export interface RunMockBatchProgressiveOptions extends RunMockBatchOptions {
  auctionConfigOverridesForRun?: (context: RunMockBatchRunContext) => AuctionEngineConfigOverrides;
  forcedSalesForRun?: (context: RunMockBatchRunContext) => readonly ForcedAuctionSale[];
  onRunComplete?: (progress: RunMockBatchProgress) => void | Promise<void>;
}

export interface MockInputCounts {
  pricedPlayers: number;
  auctionPlayers: number;
  lockedKeepers: number;
}

export interface MockRosterSummary {
  owner: Owner;
  spend: number;
  budgetRemaining: number;
  week1Score?: number;
  weeks1To4Score?: number;
  valid: boolean;
  errors: string[];
  players: MockRoster["players"];
  positionSpend: PositionAmounts;
}

export interface MockRun {
  seed: string;
  keeperScenario: KeeperScenario;
  inputCounts: MockInputCounts;
  pickCount: number;
  picks: AuctionPick[];
  budgetTrajectory: AuctionBudgetTrajectoryRow[];
  rosters: MockRosterSummary[];
  invalidRosterCount: number;
  unsoldPlayerCount: number;
}

export interface ScenarioBatchSummary {
  key: KeeperScenarioKey;
  label: string;
  runCount: number;
  invalidRosterCount: number;
  averagePickCount: number;
}

export interface PlayerBatchSummary {
  name: string;
  position: Position;
  draftedCount: number;
  draftedRate: number;
  averageMarketPrice: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
}

export interface OwnerBatchSummary {
  owner: Owner;
  runCount: number;
  invalidRosterCount: number;
  averageSpend: number;
  minimumSpend: number;
  maximumSpend: number;
  averageWeek1Score: number;
  averageWeeks1To4Score: number;
  averageBudgetRemaining: number;
  averagePositionSpend: PositionAmounts;
}

export interface OwnerPlayerExposureSummary {
  owner: Owner;
  player: string;
  position: Position;
  draftedCount: number;
  draftedRate: number;
  averagePrice: number;
}

export interface MockBatchSummary {
  runCount: number;
  scenarios: ScenarioBatchSummary[];
  players: PlayerBatchSummary[];
  owners: OwnerBatchSummary[];
  ownerPlayerExposure: OwnerPlayerExposureSummary[];
}

export interface MockBatch {
  options: {
    scenarioKeys: KeeperScenarioKey[];
    runsPerScenario: number;
    seedPrefix: string;
    diagnosticsMode?: AuctionDiagnosticsMode;
    forcedSales?: ForcedAuctionSale[];
  };
  runs: MockRun[];
  summary: MockBatchSummary;
}
