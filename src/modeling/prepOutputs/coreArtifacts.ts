import { ownerPlayerExposureCsv, ownerSummariesCsv, playerSaleRangesCsv } from "./batchSummaryCsv.js";
import { calibrationGatesCsv, calibrationSummaryCsv } from "./calibrationSummaryCsv.js";
import { csvArtifact, jsonArtifact } from "./csv.js";
import { historicalBacktestGatesCsv, mockSmokeFirstTwoRoundsCsv } from "./supportCsv.js";
import type { BuildPrepOutputArtifactsOptions, PrepOutputContent } from "./types.js";

export const coreArtifacts = (
  options: BuildPrepOutputArtifactsOptions,
): PrepOutputContent[] => {
  const artifacts: PrepOutputContent[] = [
    {
      filename: "mock-batch-summary.json",
      content: jsonArtifact({ options: options.batch.options, summary: options.batch.summary }),
    },
    {
      filename: "historical-calibration-audit.json",
      content: jsonArtifact(options.audit),
    },
  ];

  if (options.smokeReport) {
    artifacts.push(
      { filename: "mock-smoke.json", content: jsonArtifact(options.smokeReport) },
      {
        filename: "mock-smoke-first-two-rounds.csv",
        content: csvArtifact(mockSmokeFirstTwoRoundsCsv(options.smokeReport)),
      },
    );
  }

  if (options.historicalBacktest) {
    artifacts.push(
      {
        filename: "historical-backtest.json",
        content: jsonArtifact(options.historicalBacktest),
      },
      {
        filename: "historical-backtest-gates.csv",
        content: csvArtifact(historicalBacktestGatesCsv(options.historicalBacktest)),
      },
    );
  }

  artifacts.push(
    { filename: "calibration-summary.csv", content: csvArtifact(calibrationSummaryCsv(options.audit)) },
    { filename: "calibration-gates.csv", content: csvArtifact(calibrationGatesCsv(options.audit)) },
    { filename: "player-sale-ranges.csv", content: csvArtifact(playerSaleRangesCsv(options.batch)) },
    { filename: "owner-summaries.csv", content: csvArtifact(ownerSummariesCsv(options.batch)) },
    { filename: "owner-player-exposure.csv", content: csvArtifact(ownerPlayerExposureCsv(options.batch)) },
  );

  return artifacts;
};
