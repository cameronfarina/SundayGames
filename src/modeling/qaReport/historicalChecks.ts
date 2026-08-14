import type {
  QaBacktestInput,
  QaCalibrationInput,
  QaCheck,
} from "./contracts.js";
import { topGateItems } from "./gateItems.js";
import { statusFromGateSummary } from "./status.js";

export const calibrationCheck = (calibration: QaCalibrationInput): QaCheck => ({
  key: "calibration",
  label: "Historical calibration",
  status: statusFromGateSummary(calibration.gates.summary),
  severity: "hard",
  message: `${calibration.gates.summary.passCount}/${calibration.gates.summary.gateCount} calibration gates passed.`,
  topItems: topGateItems(calibration.gates.items),
});

export const backtestCheck = (backtest: QaBacktestInput): QaCheck => ({
  key: "backtest",
  label: "Historical backtest",
  status: statusFromGateSummary(backtest.summary),
  severity: "hard",
  message: `${backtest.summary.passCount}/${backtest.summary.gateCount} backtest gates passed.`,
  topItems: [],
});
