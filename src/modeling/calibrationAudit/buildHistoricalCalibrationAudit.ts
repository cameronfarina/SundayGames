import type {
  BuildHistoricalCalibrationAuditOptions,
  HistoricalCalibrationAudit,
} from "./contracts/report.js";
import { summarizeGates } from "./gates/buildGates.js";
import { historicalSeasons, openAuctionRecords } from "./historicalRecords.js";
import { summarizeOverall } from "./overallAnalysis.js";
import { summarizeOwnerSpend } from "./ownerAnalysis.js";
import {
  summarizeHighPriceVolumes,
  summarizePriceTiers,
} from "./priceAnalysis.js";
import { summarizePositionCounts } from "./positionCountAnalysis.js";
import { summarizePositionSpend } from "./positionSpendAnalysis.js";
import { summarizeScenarioCalibration } from "./scenarioAnalysis.js";
import { summarizeCalibration } from "./summary.js";

export const buildHistoricalCalibrationAudit = ({
  historicalRecords,
  batch,
}: BuildHistoricalCalibrationAuditOptions): HistoricalCalibrationAudit => {
  const records = openAuctionRecords(historicalRecords);
  const seasons = historicalSeasons(historicalRecords);
  const runs = batch.runs;
  const priceTiers = summarizePriceTiers(records, runs, seasons);
  const highPriceVolumes = summarizeHighPriceVolumes(records, runs, seasons);
  const positionCounts = summarizePositionCounts(historicalRecords, runs, seasons);
  const positionSpend = summarizePositionSpend(records, runs, seasons);
  const ownerSpend = summarizeOwnerSpend(records, runs, seasons);
  const scenarios = summarizeScenarioCalibration(batch);
  const summary = summarizeCalibration(
    batch,
    priceTiers,
    positionCounts,
    positionSpend,
    ownerSpend,
  );
  const overall = summarizeOverall(records, runs, seasons);

  return {
    runCount: runs.length,
    historicalSeasons: seasons,
    summary,
    priceTiers,
    highPriceVolumes,
    positionCounts,
    positionSpend,
    ownerSpend,
    scenarios,
    overall,
    gates: summarizeGates({
      batch,
      summary,
      priceTiers,
      highPriceVolumes,
      positionCounts,
      positionSpend,
      ownerSpend,
      overall,
    }),
  };
};
