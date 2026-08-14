import { keepers } from "../../../config/keepers.js";
import { buildHistoricalCalibrationAudit } from "../../modeling/calibrationAudit.js";
import { buildBasePrices } from "../../modeling/basePricing.js";
import { buildHistoricalBacktest } from "../../modeling/historicalBacktest.js";
import { buildKeeperScenarioSensitivityReport } from "../../modeling/keeperScenarioSensitivity.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import { buildMockSmokeReport } from "../../modeling/mockSmoke.js";
import { buildPlayerEvidenceCoverageAudit } from "../../modeling/playerEvidenceCoverage.js";
import { buildPlayerEvidenceQueue } from "../../modeling/playerEvidenceQueue.js";
import { buildPlayerOutlierReviewQueue } from "../../modeling/playerOutlierReviewQueue.js";
import { buildTopPlayerSanityReport } from "../../modeling/topPlayerSanity.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioListOption } from "../options/commonOptions.js";

export const buildPrepRun = async (arguments_: CliArguments, defaultSeedPrefix: string) => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const scenarioKeys = scenarioListOption(arguments_);
  const evidenceScenarioKey = scenarioKeys[0] ?? "expected";
  const seedPrefix = arguments_.option("--seed-prefix") ?? defaultSeedPrefix;
  const prices = buildBasePrices(players, historicalRecords, pricingConfig);
  const batch = runMockBatch({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKeys,
    runsPerScenario: arguments_.positiveInteger("--runs", 50),
    seedPrefix,
    pricingConfig,
  });
  const firstRun = batch.runs[0];
  if (!firstRun) throw new Error(`${defaultSeedPrefix === "qa" ? "QA" : "Outputs"} command did not produce a mock run.`);
  const calibration = buildHistoricalCalibrationAudit({ historicalRecords, batch });
  const smokeReport = buildMockSmokeReport({ run: firstRun, batch, rounds: 2 });
  const historicalBacktest = buildHistoricalBacktest(historicalRecords);
  const sanityReport = buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: evidenceScenarioKey,
    limit: arguments_.positiveInteger("--evidence-limit", 40),
    seedPrefix,
    pricingConfig,
    mockBatch: batch,
  });
  const evidenceQueue = buildPlayerEvidenceQueue(sanityReport);
  return {
    batch,
    calibration,
    smokeReport,
    historicalBacktest,
    evidenceQueue,
    outlierQueue: buildPlayerOutlierReviewQueue(sanityReport),
    evidenceCoverageAudit: buildPlayerEvidenceCoverageAudit(evidenceQueue),
    keeperScenarioSensitivity: buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: arguments_.positiveInteger("--scenario-sensitivity-limit", 60),
    }),
  };
};
