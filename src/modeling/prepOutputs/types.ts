import type { HistoricalBacktestReport } from "../historicalBacktest.js";
import type { HistoricalCalibrationAudit } from "../calibrationAudit.js";
import type { KeeperScenarioSensitivityReport } from "../keeperScenarioSensitivity.js";
import type { MockBatch } from "../mockBatch.js";
import type { MockSmokeReport } from "../mockSmoke.js";
import type { EvidenceCoverageAudit } from "../playerEvidenceCoverage.js";
import type { PlayerEvidenceQueue } from "../playerEvidenceQueue.js";
import type { PlayerOutlierReviewQueue } from "../playerOutlierReviewQueue.js";

export interface PrepOutputArtifact {
  filename: string;
  path: string;
  content: string;
}

export interface BuildPrepOutputArtifactsOptions {
  batch: MockBatch;
  audit: HistoricalCalibrationAudit;
  outputDirectory: string;
  smokeReport?: MockSmokeReport;
  historicalBacktest?: HistoricalBacktestReport;
  evidenceQueue?: PlayerEvidenceQueue;
  evidenceCoverageAudit?: EvidenceCoverageAudit;
  outlierQueue?: PlayerOutlierReviewQueue;
  keeperScenarioSensitivity?: KeeperScenarioSensitivityReport;
}

export interface PrepOutputContent {
  filename: string;
  content: string;
}
