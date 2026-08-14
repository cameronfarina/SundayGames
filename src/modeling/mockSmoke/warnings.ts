import type { MockRun } from "../mockBatch.js";
import type { MockSmokeBatchSummary, MockSmokePick } from "./contracts.js";

const warningHighBudgetRemaining = 15;

export const smokeWarningsFor = (
  run: MockRun,
  batch: MockSmokeBatchSummary,
  firstRounds: readonly MockSmokePick[],
  expectedPickCount: number,
): string[] => {
  const warnings: string[] = [];
  const highBudgetOwners = run.rosters
    .filter(roster => roster.budgetRemaining > warningHighBudgetRemaining)
    .map(roster => `${roster.owner} $${roster.budgetRemaining}`);

  if (run.invalidRosterCount > 0) {
    warnings.push(`${run.invalidRosterCount} invalid roster(s) in smoke run.`);
  }
  if (batch.invalidRosterCount > 0) {
    warnings.push(`${batch.invalidRosterCount} invalid roster(s) in smoke batch.`);
  }
  if (firstRounds.length < expectedPickCount) {
    warnings.push(`Smoke run did not produce ${expectedPickCount} early-round pick(s).`);
  }
  if (highBudgetOwners.length > 0) {
    warnings.push(
      `Owner budget left above $${warningHighBudgetRemaining}: ${highBudgetOwners.join(", ")}.`,
    );
  }

  return warnings;
};
