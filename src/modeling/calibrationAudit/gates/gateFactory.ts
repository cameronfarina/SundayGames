import type {
  CalibrationGate,
  CalibrationGateMode,
  CalibrationGateStatus,
  CalibrationGateSummary,
} from "../contracts/gates.js";
import { roundToTwo } from "../numeric.js";

type CalibrationGateInput =
  Omit<CalibrationGate, "delta" | "status" | "mode"> & {
    mode?: CalibrationGateMode;
  };

const gateStatus = (
  delta: number,
  warnThreshold: number,
  failThreshold: number,
  mode: CalibrationGateMode = "absolute",
): CalibrationGateStatus => {
  const magnitude = mode === "maximum"
    ? Math.max(0, delta)
    : mode === "minimum"
      ? Math.max(0, -delta)
      : Math.abs(delta);
  if (magnitude >= failThreshold) return "fail";
  if (magnitude >= warnThreshold) return "warn";
  return "pass";
};

export const calibrationGate = ({
  key,
  category,
  label,
  target,
  actual,
  warnThreshold,
  failThreshold,
  mode = "absolute",
}: CalibrationGateInput): CalibrationGate => {
  const delta = roundToTwo(actual - target);

  return {
    key,
    category,
    label,
    status: gateStatus(delta, warnThreshold, failThreshold, mode),
    mode,
    target,
    actual,
    delta,
    warnThreshold,
    failThreshold,
  };
};

export const summarizeGateStatuses = (
  items: readonly CalibrationGate[],
): CalibrationGateSummary => {
  const failCount = items.filter(gate => gate.status === "fail").length;
  const warnCount = items.filter(gate => gate.status === "warn").length;
  const passCount = items.filter(gate => gate.status === "pass").length;
  let status: CalibrationGateStatus = "pass";

  if (failCount > 0) {
    status = "fail";
  } else if (warnCount > 0) {
    status = "warn";
  }

  return {
    status,
    credible: failCount === 0,
    gateCount: items.length,
    passCount,
    warnCount,
    failCount,
  };
};
