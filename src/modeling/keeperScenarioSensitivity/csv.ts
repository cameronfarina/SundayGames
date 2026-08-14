import type { KeeperScenarioKey } from "../keeperInflation.js";
import { keeperScenarioSensitivityKeys } from "./constants.js";
import type {
  CsvValue,
  KeeperScenarioSensitivityReport,
  KeeperScenarioSensitivityRow,
} from "./contracts.js";

const csvCell = (value: CsvValue): string => {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const scenarioList = (values: readonly string[]): string => values.join("; ");

const unavailableReasonSummaryFor = (
  row: KeeperScenarioSensitivityRow,
): string[] => {
  const scenariosByReason = new Map<string, KeeperScenarioKey[]>();
  for (const key of keeperScenarioSensitivityKeys) {
    const reason = row.scenarios[key].unavailableReason;
    if (reason === undefined) continue;
    scenariosByReason.set(reason, [...(scenariosByReason.get(reason) ?? []), key]);
  }
  return [...scenariosByReason.entries()].map(
    ([reason, keys]) => `${keys.join("/")}: ${reason}`,
  );
};

const headers = [
  "rank", "player", "position", "base_price",
  "confirmed_only_available", "confirmed_only_price", "confirmed_only_factor",
  "expected_available", "expected_price", "expected_factor",
  "high_retention_available", "high_retention_price", "high_retention_factor",
  "price_spread", "expected_vs_confirmed_delta", "high_retention_vs_expected_delta",
  "keeper_removed", "keeper_removal_scenarios", "keeper_removal_changed",
  "availability_changed", "unavailable_scenarios", "unavailable_reasons",
];

const valuesFor = (row: KeeperScenarioSensitivityRow): CsvValue[] => [
  row.rank, row.player, row.position, row.basePrice,
  row.scenarios.confirmedOnly.available,
  row.scenarios.confirmedOnly.scenarioPrice,
  row.scenarios.confirmedOnly.scenarioFactor,
  row.scenarios.expected.available,
  row.scenarios.expected.scenarioPrice,
  row.scenarios.expected.scenarioFactor,
  row.scenarios.highRetention.available,
  row.scenarios.highRetention.scenarioPrice,
  row.scenarios.highRetention.scenarioFactor,
  row.priceSpread,
  row.expectedVsConfirmedDelta,
  row.highRetentionVsExpectedDelta,
  row.keeperRemoved,
  scenarioList(row.keeperRemovalScenarios),
  row.keeperRemovalChanged,
  row.availabilityChanged,
  scenarioList(row.unavailableScenarios),
  scenarioList(unavailableReasonSummaryFor(row)),
];

export const keeperScenarioSensitivityCsv = (
  report: KeeperScenarioSensitivityReport,
): string => [
  headers.map(csvCell).join(","),
  ...report.rows.map(row => valuesFor(row).map(csvCell).join(",")),
].join("\n");
