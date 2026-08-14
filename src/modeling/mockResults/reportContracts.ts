import type { Owner } from "../../../config/league.js";
import type { MockBatch, MockBatchSummary } from "../mockBatch.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import type { MockResultsAnalytics } from "./analyticsContracts.js";
import type { MockResultsScriptSummary } from "./scriptContracts.js";
import type {
  MockResultsBuildSummary,
  MockResultsCamOutcome,
  MockResultsRanking,
  MockResultsTeam,
} from "./teamContracts.js";

export interface MockResultsRun {
  index: number;
  label: string;
  seed: string;
  strategyKey: LiveDraftStrategyKey;
  scenarioLabel: string;
  teams: MockResultsTeam[];
  rankings: MockResultsRanking[];
  bestBuild: MockResultsBuildSummary;
  worstBuild: MockResultsBuildSummary;
  camOutcome: MockResultsCamOutcome;
}

export interface MockResultsReport {
  mode: "batch-mock";
  watchOwner: Owner;
  options: MockBatch["options"] & {
    strategyKey: LiveDraftStrategyKey;
  };
  summary: MockBatchSummary;
  runStrategyKeys: LiveDraftStrategyKey[];
  runs: MockResultsRun[];
  analytics: MockResultsAnalytics;
  script?: MockResultsScriptSummary;
  cam?: MockBatchSummary["owners"][number];
  camTopExposures: MockBatchSummary["ownerPlayerExposure"];
  topPlayers: MockBatchSummary["players"];
}
