import type {
  QaGateSummaryInput,
  QaSmokeInput,
  QaStatus,
  QaSummary,
} from "./contracts.js";

export const statusFromGateSummary = (summary: QaGateSummaryInput): QaStatus => {
  if (summary.credible === false || summary.failCount > 0 || summary.status === "fail") {
    return "fail";
  }
  if (summary.warnCount > 0 || summary.status === "warn") return "warn";
  return "pass";
};

export const smokeCheckStatus = (smoke: QaSmokeInput): QaStatus => {
  const batchInvalidRosterCount = smoke.batch?.invalidRosterCount ?? 0;
  if (
    smoke.invalidRosterCount > 0 ||
    batchInvalidRosterCount > 0 ||
    smoke.firstTwoRoundSummary.pickCount <= 0
  ) {
    return "fail";
  }
  return smoke.warnings.length > 0 ? "warn" : "pass";
};

export const overallStatus = (summary: QaSummary): QaStatus => {
  if (summary.hardFailCount > 0) return "fail";
  const hasWarnings = summary.hardWarnCount > 0 ||
    summary.advisoryFailCount > 0 ||
    summary.advisoryWarnCount > 0;
  return hasWarnings ? "warn" : "pass";
};
