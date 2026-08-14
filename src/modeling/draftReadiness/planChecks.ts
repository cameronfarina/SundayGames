import { leagueConfig } from "../../../config/league.js";
import type { DraftPlanReport } from "../draftPlan.js";
import type { MockBatch } from "../mockBatch.js";
import type { QaStatus } from "../qaReport.js";
import type { DraftReadyCheck } from "./contracts.js";

export const draftPlanMatchCheck = (
  report: DraftPlanReport,
  minimumMatches: number,
): DraftReadyCheck => {
  let status: QaStatus = "pass";
  if (report.matchedRunCount === 0) status = "fail";
  else if (report.matchedRunCount < minimumMatches) status = "warn";
  return {
    key: "draft-plan-matches",
    label: "Draft plan matches",
    status,
    severity: "hard",
    message: `${report.matchedRunCount}/${report.runCount} run(s) produced matching ${report.strategy.label} plans; target is ${minimumMatches}.`,
  };
};

export const rosterValidityCheck = (batch: MockBatch): DraftReadyCheck => {
  const invalidRosterCount = batch.summary.scenarios.reduce(
    (total, scenario) => total + scenario.invalidRosterCount,
    0,
  );
  return {
    key: "roster-validity",
    label: "Roster validity",
    status: invalidRosterCount === 0 ? "pass" : "fail",
    severity: "hard",
    message: invalidRosterCount === 0
      ? "All draft-plan simulation rosters were valid."
      : `${invalidRosterCount} invalid draft-plan roster(s) found.`,
  };
};

export const candidateShapeCheck = (report: DraftPlanReport): DraftReadyCheck => {
  const candidate = report.candidates[0];
  if (candidate === undefined) {
    return {
      key: "top-candidate-shape",
      label: "Top candidate shape",
      status: "fail",
      severity: "hard",
      message: "No top plan passed the required strategy shape.",
    };
  }
  const valid = report.strategy.key === "three-rb"
    ? candidate.rbCore.length === 3
      && candidate.rosterSpend <= leagueConfig.auctionBudget
      && candidate.rbCoreSpend >= report.strategy.thresholds.rbCoreSpendMinimum
    : candidate.lineup.length >= 9
      && candidate.rosterSpend <= leagueConfig.auctionBudget
      && candidate.players.length >= leagueConfig.rosterSize;
  return {
    key: "top-candidate-shape",
    label: "Top candidate shape",
    status: valid ? "pass" : "fail",
    severity: "hard",
    message: report.strategy.key === "three-rb"
      ? valid
        ? `Top plan has a $${candidate.rbCoreSpend} RB core and $${candidate.rosterSpend} total spend.`
        : `Top plan shape missed the strategy constraints: $${candidate.rbCoreSpend} RB core, $${candidate.rosterSpend} total spend.`
      : valid
        ? `Top ${report.strategy.label} plan has a legal lineup, ${candidate.players.length} players, and $${candidate.rosterSpend} total spend.`
        : `Top ${report.strategy.label} plan missed lineup, roster-size, or budget constraints: ${candidate.lineup.length} starters, ${candidate.players.length} players, $${candidate.rosterSpend} total spend.`,
  };
};
