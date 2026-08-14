import { keepers } from "../../../config/keepers.js";
import { buildHistoricalCalibrationAudit } from "../../modeling/calibrationAudit.js";
import { buildHistoricalBacktest } from "../../modeling/historicalBacktest.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import { buildMockSmokeReport } from "../../modeling/mockSmoke.js";
import { buildPlayerEvidenceCoverageAudit } from "../../modeling/playerEvidenceCoverage.js";
import { buildPlayerEvidenceQueue } from "../../modeling/playerEvidenceQueue.js";
import { buildQaReport } from "../../modeling/qaReport.js";
import { buildTopPlayerSanityReport } from "../../modeling/topPlayerSanity.js";
import type { CliArguments } from "../arguments.js";
import type { loadPricingInputs } from "../inputs.js";
import type { KeeperScenarioKey } from "../../modeling/keeperInflation.js";

type PricingInputs = Awaited<ReturnType<typeof loadPricingInputs>>;

export const buildDraftReadinessQa = (
  arguments_: CliArguments,
  inputs: PricingInputs,
  scenarioKey: KeeperScenarioKey,
  qaRuns: number,
  seedPrefix: string,
) => {
  const qaBatch = runMockBatch({
    projections: inputs.players,
    historicalRecords: inputs.historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: qaRuns,
    seedPrefix,
    pricingConfig: inputs.pricingConfig,
  });
  const firstRun = qaBatch.runs[0];
  if (!firstRun) throw new Error("Draft readiness command did not produce a QA mock run.");
  const sanity = buildTopPlayerSanityReport({
    projections: inputs.players,
    historicalRecords: inputs.historicalRecords,
    keepers,
    scenarioKey,
    limit: arguments_.positiveInteger("--evidence-limit", 40),
    seedPrefix,
    pricingConfig: inputs.pricingConfig,
  });
  return buildQaReport({
    options: { scenarioKeys: [scenarioKey], runsPerScenario: qaRuns, seedPrefix },
    smoke: buildMockSmokeReport({ run: firstRun, batch: qaBatch, rounds: 2 }),
    calibration: buildHistoricalCalibrationAudit({
      historicalRecords: inputs.historicalRecords,
      batch: qaBatch,
    }),
    backtest: buildHistoricalBacktest(inputs.historicalRecords),
    evidenceCoverage: buildPlayerEvidenceCoverageAudit(buildPlayerEvidenceQueue(sanity)),
  });
};
