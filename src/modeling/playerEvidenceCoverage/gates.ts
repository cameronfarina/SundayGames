import type {
  EvidenceCoverageGate,
  EvidenceCoverageGateSummary,
  EvidenceCoverageStatus,
} from "./contracts.js";

export const minimumCoverageRate = 0.8;
export const failingCoverageRate = 0.5;
export const minimumCompleteEvidenceRate = 0.6;
export const failingCompleteEvidenceRate = 0.25;
export const minimumProvenanceRate = 1;
export const failingProvenanceRate = 0.75;

export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const rate = (count: number, total: number): number =>
  total === 0 ? 1 : roundToTwo(count / total);

export const rateGateStatus = (
  actual: number,
  warnThreshold: number,
  failThreshold: number,
): EvidenceCoverageStatus => {
  if (actual < failThreshold) return "fail";
  if (actual < warnThreshold) return "warn";
  return "pass";
};

const worstStatus = (statuses: readonly EvidenceCoverageStatus[]): EvidenceCoverageStatus => {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
};

export const gateSummary = (items: readonly EvidenceCoverageGate[]): EvidenceCoverageGateSummary => ({
  status: worstStatus(items.map(item => item.status)),
  gateCount: items.length,
  passCount: items.filter(item => item.status === "pass").length,
  warnCount: items.filter(item => item.status === "warn").length,
  failCount: items.filter(item => item.status === "fail").length,
});
