import type { KeeperScenarioKey } from "../keeperInflation.js";

export type QaStatus = "pass" | "warn" | "fail";
export type QaSeverity = "hard" | "advisory";

export interface QaRunOptions {
  scenarioKeys: readonly KeeperScenarioKey[];
  runsPerScenario: number;
  seedPrefix: string;
}

export interface QaGateSummaryInput {
  status: QaStatus;
  credible?: boolean;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface QaGateItemInput {
  key: string;
  label?: string;
  status: QaStatus;
}

export interface QaSmokeInput {
  invalidRosterCount: number;
  batch?: {
    invalidRosterCount: number;
  };
  firstTwoRoundSummary: {
    pickCount: number;
  };
  warnings: readonly string[];
}

export interface QaCalibrationInput {
  gates: {
    summary: QaGateSummaryInput;
    items: readonly QaGateItemInput[];
  };
}

export interface QaBacktestInput {
  summary: QaGateSummaryInput;
}

export interface QaEvidenceCoverageInput {
  summary: {
    status: QaStatus;
    highPriorityMissingCount: number;
    missingEvidenceCount: number;
    provenanceIncompleteEvidenceCount?: number;
    coverageRate: number;
    completeEvidenceRate: number;
    provenanceCompleteEvidenceRate?: number;
  };
  gates: {
    summary: QaGateSummaryInput;
  };
}

export interface BuildQaReportOptions {
  options: QaRunOptions;
  smoke: QaSmokeInput;
  calibration: QaCalibrationInput;
  backtest: QaBacktestInput;
  evidenceCoverage?: QaEvidenceCoverageInput;
  artifactPaths?: readonly string[];
}

export interface QaCheck {
  key: string;
  label: string;
  status: QaStatus;
  severity: QaSeverity;
  message: string;
  topItems: QaGateItemInput[];
}

export interface QaSummary {
  checkCount: number;
  hardFailCount: number;
  hardWarnCount: number;
  advisoryFailCount: number;
  advisoryWarnCount: number;
}

export interface QaReport {
  status: QaStatus;
  recommendedExitCode: 0 | 1;
  options: QaRunOptions;
  summary: QaSummary;
  checks: QaCheck[];
  artifactPaths: readonly string[];
}
