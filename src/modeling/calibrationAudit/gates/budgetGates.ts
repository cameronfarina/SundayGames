import type { MockBatch } from "../../mockBatch.js";
import type { CalibrationGate } from "../contracts/gates.js";
import type {
  BudgetRemainingCalibrationSummary,
} from "../contracts/report.js";
import { calibrationGate } from "./gateFactory.js";

export const rosterValidityGate = (batch: MockBatch): CalibrationGate => {
  const invalidRosterCount = batch.summary.scenarios.reduce(
    (count, scenario) => count + scenario.invalidRosterCount,
    0,
  );

  return calibrationGate({
    key: "roster-validity",
    category: "roster_validity",
    label: "Invalid roster count",
    target: 0,
    actual: invalidRosterCount,
    warnThreshold: 0.5,
    failThreshold: 1,
  });
};

const maxOwnerAverageBudgetRemaining = (
  summary: BudgetRemainingCalibrationSummary,
): number =>
  summary.ownersWithAverageBudgetRemaining[0]?.averageBudgetRemaining ?? 0;

export const budgetRemainingGates = (
  summary: BudgetRemainingCalibrationSummary,
): CalibrationGate[] => [
  calibrationGate({
    key: "budget-remaining:league-average",
    category: "budget_remaining",
    label: "League average budget remaining",
    target: 0,
    actual: summary.leagueAverageBudgetRemaining,
    warnThreshold: 4,
    failThreshold: 7,
  }),
  calibrationGate({
    key: "budget-remaining:max-owner",
    category: "budget_remaining",
    label: "Highest owner average budget remaining",
    target: 0,
    actual: maxOwnerAverageBudgetRemaining(summary),
    warnThreshold: 10,
    failThreshold: 20,
  }),
];
