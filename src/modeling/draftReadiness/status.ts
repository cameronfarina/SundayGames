import type { QaStatus } from "../qaReport.js";
import type {
  DraftReadyCheck,
  DraftReadySummary,
} from "./contracts.js";

export const checkSummary = (checks: readonly DraftReadyCheck[]): DraftReadySummary => ({
  checkCount: checks.length,
  hardFailCount: checks.filter(check => check.severity === "hard" && check.status === "fail").length,
  hardWarnCount: checks.filter(check => check.severity === "hard" && check.status === "warn").length,
  advisoryFailCount: checks.filter(check => check.severity === "advisory" && check.status === "fail").length,
  advisoryWarnCount: checks.filter(check => check.severity === "advisory" && check.status === "warn").length,
});

export const overallStatus = (summary: DraftReadySummary): QaStatus => {
  if (summary.hardFailCount > 0) return "fail";
  if (summary.hardWarnCount > 0 || summary.advisoryFailCount > 0 || summary.advisoryWarnCount > 0) {
    return "warn";
  }
  return "pass";
};
