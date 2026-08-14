import { baseGates } from "./baseGates.js";
import type { HistoricalBacktestGates, HistoricalSeasonShape } from "./contracts.js";
import { summarizeGateStatuses } from "./gateCore.js";
import { positionGates } from "./positionGates.js";

export const gatesFor = (
  actual: HistoricalSeasonShape,
  baseline: HistoricalSeasonShape,
): HistoricalBacktestGates => {
  const items = [...baseGates(actual, baseline), ...positionGates(actual, baseline)];
  return { summary: summarizeGateStatuses(items), items };
};
