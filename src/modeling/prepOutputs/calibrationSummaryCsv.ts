import type { HistoricalCalibrationAudit } from "../calibrationAudit.js";
import type { CsvValue } from "./csv.js";
import { toCsv } from "./csv.js";

const deltaRow = (
  category: string,
  delta: { key: string; label: string; target: number; actual: number; delta: number },
): readonly CsvValue[] => [
  category, delta.key, delta.label, delta.target, delta.actual, delta.delta,
];

export const calibrationSummaryCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    ["category", "key", "label", "target", "actual", "delta"],
    [
      ...audit.summary.largestPriceTierCountDeltas.map(delta =>
        deltaRow("price_tier_count", delta)),
      ...audit.summary.largestPositionCountDeltas.map(delta =>
        deltaRow("position_count", delta)),
      ...audit.summary.largestPositionSpendDeltas.map(delta =>
        deltaRow("position_spend", delta)),
      ...audit.summary.largestOwnerSpendDeltas.map(delta =>
        deltaRow("owner_spend", delta)),
      ...audit.summary.budgetRemaining.ownersWithAverageBudgetRemaining.map(
        (owner): readonly CsvValue[] => [
          "budget_remaining", owner.owner, owner.owner, 0,
          owner.averageBudgetRemaining, owner.averageBudgetRemaining,
        ],
      ),
    ],
  );

export const calibrationGatesCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    [
      "key", "category", "label", "status", "mode", "target", "actual",
      "delta", "warn_threshold", "fail_threshold",
    ],
    audit.gates.items.map(gate => [
      gate.key, gate.category, gate.label, gate.status, gate.mode, gate.target,
      gate.actual, gate.delta, gate.warnThreshold, gate.failThreshold,
    ]),
  );
