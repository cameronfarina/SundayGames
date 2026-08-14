import type {
  HistoricalBacktestGate,
  HistoricalBacktestGateStatus,
  HistoricalBacktestGateSummary,
  HistoricalCountSummary,
} from "./contracts.js";
import { roundToTwo } from "./records.js";

type GateMode = "absolute" | "maximum";
type GateInput = Omit<HistoricalBacktestGate, "delta" | "status"> & { mode?: GateMode };

const gateStatus = (
  delta: number,
  warnThreshold: number,
  failThreshold: number,
  mode: GateMode,
): HistoricalBacktestGateStatus => {
  const magnitude = mode === "maximum" ? Math.max(0, delta) : Math.abs(delta);
  if (magnitude >= failThreshold) return "fail";
  if (magnitude >= warnThreshold) return "warn";
  return "pass";
};

export const backtestGate = (input: GateInput): HistoricalBacktestGate => {
  const delta = roundToTwo(input.actual - input.target);
  return {
    key: input.key,
    category: input.category,
    label: input.label,
    status: gateStatus(delta, input.warnThreshold, input.failThreshold, input.mode ?? "absolute"),
    target: input.target,
    actual: input.actual,
    delta,
    warnThreshold: input.warnThreshold,
    failThreshold: input.failThreshold,
  };
};

export const summarizeGateStatuses = (
  items: readonly HistoricalBacktestGate[],
): HistoricalBacktestGateSummary => {
  const failCount = items.filter(gate => gate.status === "fail").length;
  const warnCount = items.filter(gate => gate.status === "warn").length;
  const passCount = items.filter(gate => gate.status === "pass").length;
  const status = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";
  return {
    status,
    credible: failCount === 0,
    gateCount: items.length,
    passCount,
    warnCount,
    failCount,
  };
};

export const countFor = (counts: readonly HistoricalCountSummary[], key: string): number => {
  const count = counts.find(candidate => candidate.key === key);
  if (!count) throw new Error(`Missing historical count "${key}".`);
  return count.count;
};
