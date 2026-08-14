import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { Owner } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../projections.js";
import type { PricingConfig } from "../basePricing.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { ForcedAuctionSale } from "../mockBatch.js";
import type { MockResultsPlayer } from "../mockResults.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import type {
  StrategyLabForcedStart,
  StrategyLabScenario,
  StrategyLabTargetMaxBid,
} from "./scenarioContracts.js";

export interface StrategyLabSampleBuild {
  label: string;
  seed: string;
  camRank: number;
  camWeek1Score: number;
  camSeasonStrengthScore: number;
  camSpend: number;
  camBudgetRemaining: number;
  camBenchWeek1Score: number;
  camStarterFloorWeek1Score: number;
  camDollarPlayers: number;
  thinnessScore: number;
  corePlayers: string[];
  camPlayers: MockResultsPlayer[];
}

export interface StrategyLabTargetOutcome {
  owner: Owner;
  player: string;
  maxBid: number;
  runCount: number;
  draftedByCamCount: number;
  draftedByCamRate: number;
  draftedByOtherCount: number;
  missedCount: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
}

export interface StrategyLabScenarioResult {
  key: string;
  label: string;
  question: string;
  strategyKey: LiveDraftStrategyKey;
  forcedSales: ForcedAuctionSale[];
  targetMaxBids: StrategyLabTargetMaxBid[];
  targetOutcomes: StrategyLabTargetOutcome[];
  notes?: string;
  camForcedStart: StrategyLabForcedStart;
  runCount: number;
  averageCamRank: number;
  bestCamRank: number;
  worstCamRank: number;
  averageCamWeek1Score: number;
  averageCamSeasonStrengthScore: number;
  averageCamSpend: number;
  averageCamBudgetRemaining: number;
  averageCamBenchWeek1Score: number;
  averageCamStarterFloorWeek1Score: number;
  averageCamDollarPlayers: number;
  averageThinnessScore: number;
  sampleBuilds: StrategyLabSampleBuild[];
}

export interface StrategyLabLeaderboardEntry {
  key: string;
  label: string;
  averageCamRank: number;
  bestCamRank: number;
  worstCamRank: number;
  averageCamWeek1Score: number;
  averageCamSeasonStrengthScore: number;
  averageThinnessScore: number;
}

export interface StrategyLabReport {
  mode: "strategy-lab";
  options: {
    scenarioKey: KeeperScenarioKey;
    runsPerScenario: number;
    seedPrefix: string;
  };
  leaderboard: StrategyLabLeaderboardEntry[];
  scenarios: StrategyLabScenarioResult[];
}

export interface RunStrategyLabOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarios?: readonly StrategyLabScenario[];
  scenarioKey?: KeeperScenarioKey;
  runsPerScenario?: number;
  seedPrefix?: string;
  pricingConfig?: PricingConfig;
}
