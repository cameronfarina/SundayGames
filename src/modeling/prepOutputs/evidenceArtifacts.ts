import { keeperScenarioSensitivityCsv } from "../keeperScenarioSensitivity.js";
import { playerEvidenceCoverageGatesCsv } from "../playerEvidenceCoverage.js";
import { playerEvidenceQueueCsv } from "../playerEvidenceQueue.js";
import { playerEvidenceTemplateCsv } from "../playerEvidenceTemplate.js";
import { playerOutlierReviewQueueCsv } from "../playerOutlierReviewQueue.js";
import { csvArtifact, jsonArtifact } from "./csv.js";
import type { BuildPrepOutputArtifactsOptions, PrepOutputContent } from "./types.js";

export const evidenceArtifacts = (
  options: BuildPrepOutputArtifactsOptions,
): PrepOutputContent[] => {
  const artifacts: PrepOutputContent[] = [];

  if (options.evidenceQueue) {
    artifacts.push(
      {
        filename: "player-evidence-queue.csv",
        content: csvArtifact(playerEvidenceQueueCsv(options.evidenceQueue)),
      },
      {
        filename: "player-evidence-template.csv",
        content: csvArtifact(playerEvidenceTemplateCsv(options.evidenceQueue)),
      },
    );
  }

  if (options.outlierQueue) {
    artifacts.push({
      filename: "player-outlier-review-queue.csv",
      content: csvArtifact(playerOutlierReviewQueueCsv(options.outlierQueue)),
    });
  }

  if (options.keeperScenarioSensitivity) {
    artifacts.push(
      {
        filename: "keeper-scenario-sensitivity.json",
        content: jsonArtifact(options.keeperScenarioSensitivity),
      },
      {
        filename: "keeper-scenario-sensitivity.csv",
        content: csvArtifact(keeperScenarioSensitivityCsv(options.keeperScenarioSensitivity)),
      },
    );
  }

  if (options.evidenceCoverageAudit) {
    artifacts.push(
      {
        filename: "player-evidence-coverage.json",
        content: jsonArtifact(options.evidenceCoverageAudit),
      },
      {
        filename: "player-evidence-coverage-gates.csv",
        content: csvArtifact(playerEvidenceCoverageGatesCsv(options.evidenceCoverageAudit)),
      },
    );
  }

  return artifacts;
};
