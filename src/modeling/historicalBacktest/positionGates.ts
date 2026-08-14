import { ownerOrder, positions } from "../../../config/league.js";
import { positionCountThresholds, positionSpendThresholds } from "./constants.js";
import type { HistoricalBacktestGate, HistoricalSeasonShape } from "./contracts.js";
import { backtestGate } from "./gateCore.js";

export const positionGates = (
  actual: HistoricalSeasonShape,
  baseline: HistoricalSeasonShape,
): HistoricalBacktestGate[] => [
  ...positions.map(position => {
    const thresholds = positionCountThresholds[position];
    return backtestGate({
      key: `position-count:${position}`,
      category: "position_count",
      label: `${position} roster count`,
      target: baseline.positionCounts[position],
      actual: actual.positionCounts[position],
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
    });
  }),
  ...positions.map(position => {
    const thresholds = positionSpendThresholds[position];
    return backtestGate({
      key: `position-spend:${position}`,
      category: "position_spend",
      label: `${position} spend`,
      target: baseline.positionSpend[position],
      actual: actual.positionSpend[position],
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
    });
  }),
  ...ownerOrder.map(owner => backtestGate({
    key: `owner-spend:${owner}`,
    category: "owner_spend",
    label: `${owner} auction spend`,
    target: baseline.ownerSpend[owner] ?? 0,
    actual: actual.ownerSpend[owner] ?? 0,
    warnThreshold: 60,
    failThreshold: 160,
  })),
];
