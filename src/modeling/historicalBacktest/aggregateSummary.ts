import type {
  HistoricalBacktestDeltaSummary,
  HistoricalBacktestGate,
  HistoricalBacktestGateStatus,
  HistoricalBacktestSummary,
  HistoricalSeasonBacktest,
} from "./contracts.js";
import { roundToTwo } from "./records.js";

const statusWeight = (status: HistoricalBacktestGateStatus): number => {
  if (status === "fail") return 2;
  if (status === "warn") return 1;
  return 0;
};

const thresholdPressure = (gate: HistoricalBacktestGate): number =>
  gate.warnThreshold === 0 ? 0 : roundToTwo(Math.abs(gate.delta) / gate.warnThreshold);

const byImportance = (
  left: HistoricalBacktestDeltaSummary,
  right: HistoricalBacktestDeltaSummary,
): number =>
  statusWeight(right.status) - statusWeight(left.status)
  || right.thresholdPressure - left.thresholdPressure
  || Math.abs(right.delta) - Math.abs(left.delta)
  || left.season - right.season
  || left.key.localeCompare(right.key);

const largestDeltas = (
  seasonBacktests: readonly HistoricalSeasonBacktest[],
): HistoricalBacktestDeltaSummary[] => seasonBacktests.flatMap(backtest =>
  backtest.gates.items.map(gate => ({
    season: backtest.season,
    key: gate.key,
    category: gate.category,
    label: gate.label,
    target: gate.target,
    actual: gate.actual,
    delta: gate.delta,
    thresholdPressure: thresholdPressure(gate),
    status: gate.status,
  }))).sort(byImportance).slice(0, 10);

export const aggregateSummary = (
  seasonBacktests: readonly HistoricalSeasonBacktest[],
): HistoricalBacktestSummary => {
  const summaries = seasonBacktests.map(backtest => backtest.gates.summary);
  const passCount = summaries.reduce((total, summary) => total + summary.passCount, 0);
  const warnCount = summaries.reduce((total, summary) => total + summary.warnCount, 0);
  const failCount = summaries.reduce((total, summary) => total + summary.failCount, 0);
  const gateCount = summaries.reduce((total, summary) => total + summary.gateCount, 0);
  return {
    status: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    credible: failCount === 0,
    gateCount,
    passCount,
    warnCount,
    failCount,
    seasonCount: seasonBacktests.length,
    largestDeltas: largestDeltas(seasonBacktests),
  };
};
