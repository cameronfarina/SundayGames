import type {
  BuildQaReportOptions,
  QaCheck,
  QaReport,
} from "./contracts.js";
import { evidenceCoverageCheck } from "./evidenceCoverageCheck.js";
import { backtestCheck, calibrationCheck } from "./historicalChecks.js";
import { smokeCheck } from "./smokeCheck.js";
import { overallStatus } from "./status.js";
import { summarizeChecks } from "./summary.js";

export const buildQaReport = ({
  options,
  smoke,
  calibration,
  backtest,
  evidenceCoverage,
  artifactPaths = [],
}: BuildQaReportOptions): QaReport => {
  const checks: QaCheck[] = [
    smokeCheck(smoke),
    calibrationCheck(calibration),
    backtestCheck(backtest),
  ];
  if (evidenceCoverage !== undefined) {
    checks.push(evidenceCoverageCheck(evidenceCoverage));
  }
  const summary = summarizeChecks(checks);

  return {
    status: overallStatus(summary),
    recommendedExitCode: summary.hardFailCount > 0 ? 1 : 0,
    options,
    summary,
    checks,
    artifactPaths,
  };
};
