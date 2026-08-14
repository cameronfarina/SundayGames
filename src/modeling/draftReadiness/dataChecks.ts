import { leagueConfig } from "../../../config/league.js";
import type { QaReport } from "../qaReport.js";
import type {
  DraftReadyCheck,
  DraftReadyDataCounts,
} from "./contracts.js";

export const dataCheck = (counts: DraftReadyDataCounts): DraftReadyCheck => {
  const missingInputs = [
    counts.projections > 0 ? undefined : "projections",
    counts.historicalRecords > 0 ? undefined : "historical records",
    counts.keepers > 0 ? undefined : "keepers",
  ].filter((input): input is string => input !== undefined);
  const keeperCoverageIsPartial = missingInputs.length === 0 && counts.keepers < leagueConfig.teams;
  return {
    key: "data-inputs",
    label: "Data inputs",
    status: missingInputs.length === 0 ? (keeperCoverageIsPartial ? "warn" : "pass") : "fail",
    severity: "hard",
    message: missingInputs.length
      ? `Missing required input data: ${missingInputs.join(", ")}.`
      : keeperCoverageIsPartial
        ? `${counts.projections} projections, ${counts.historicalRecords} historical records, and ${counts.keepers}/${leagueConfig.teams} keeper declarations loaded. Confirm missing owners before draft night.`
        : `${counts.projections} projections, ${counts.historicalRecords} historical records, and ${counts.keepers} keeper declarations loaded.`,
  };
};

export const qaCheck = (report: QaReport): DraftReadyCheck => ({
  key: "qa",
  label: "Engine QA",
  status: report.recommendedExitCode === 1 ? "fail" : report.status,
  severity: "hard",
  message: report.recommendedExitCode === 1
    ? `${report.summary.hardFailCount} hard QA failure(s) need attention.`
    : `QA status is ${report.status}; ${report.summary.hardFailCount} hard failure(s).`,
});
