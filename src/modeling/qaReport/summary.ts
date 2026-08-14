import type { QaCheck, QaSummary } from "./contracts.js";

const countChecks = (
  checks: readonly QaCheck[],
  severity: QaCheck["severity"],
  status: QaCheck["status"],
): number => checks.filter(check =>
  check.severity === severity && check.status === status).length;

export const summarizeChecks = (checks: readonly QaCheck[]): QaSummary => ({
  checkCount: checks.length,
  hardFailCount: countChecks(checks, "hard", "fail"),
  hardWarnCount: countChecks(checks, "hard", "warn"),
  advisoryFailCount: countChecks(checks, "advisory", "fail"),
  advisoryWarnCount: countChecks(checks, "advisory", "warn"),
});
