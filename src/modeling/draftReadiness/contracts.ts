import type { Owner } from "../../../config/league.js";
import type { DraftPlanReport, DraftPlanStrategyKey } from "../draftPlan.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { MockBatch } from "../mockBatch.js";
import type { QaReport, QaSeverity, QaStatus } from "../qaReport.js";

export type DraftReadyStrategyMode = "filter" | "force";
export type DraftReadyEngineMode = "fast" | "full";

export interface DraftReadyDataCounts {
  projections: number;
  historicalRecords: number;
  keepers: number;
}

export interface DraftReadyOptions {
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  strategyMode: DraftReadyStrategyMode;
  scenarioKey: KeeperScenarioKey;
  runs: number;
  qaRuns: number;
  seedPrefix: string;
  engineMode: DraftReadyEngineMode;
  minimumMatches: number;
}

export interface DraftReadyCheck {
  key: string;
  label: string;
  status: QaStatus;
  severity: QaSeverity;
  message: string;
}

export interface DraftReadyTopCandidate {
  seed: string;
  rosterSpend: number;
  budgetRemaining: number;
  weeks1To4Score: number;
  rbCoreSpend: number;
  rbCore: string[];
}

export interface DraftReadySummary {
  checkCount: number;
  hardFailCount: number;
  hardWarnCount: number;
  advisoryFailCount: number;
  advisoryWarnCount: number;
}

export interface DraftReadyReport {
  status: QaStatus;
  recommendedExitCode: 0 | 1;
  options: DraftReadyOptions;
  summary: DraftReadySummary;
  checks: DraftReadyCheck[];
  dataCounts: DraftReadyDataCounts;
  qa: {
    status: QaStatus;
    recommendedExitCode: 0 | 1;
    hardFailCount: number;
    hardWarnCount: number;
  };
  draftPlan: {
    engineMode: DraftReadyEngineMode;
    runCount: number;
    matchedRunCount: number;
    candidateLimit: number;
    topCandidate?: DraftReadyTopCandidate;
  };
}

export interface BuildDraftReadyReportOptions {
  options: DraftReadyOptions;
  dataCounts: DraftReadyDataCounts;
  qaReport: QaReport;
  draftPlanReport: DraftPlanReport;
  planBatch: MockBatch;
}
