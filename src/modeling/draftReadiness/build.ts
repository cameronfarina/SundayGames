import { topCandidateFor } from "./candidate.js";
import type {
  BuildDraftReadyReportOptions,
  DraftReadyReport,
} from "./contracts.js";
import { dataCheck, qaCheck } from "./dataChecks.js";
import {
  candidateShapeCheck,
  draftPlanMatchCheck,
  rosterValidityCheck,
} from "./planChecks.js";
import { checkSummary, overallStatus } from "./status.js";

export const buildDraftReadyReport = ({
  options,
  dataCounts,
  qaReport,
  draftPlanReport,
  planBatch,
}: BuildDraftReadyReportOptions): DraftReadyReport => {
  const topCandidate = topCandidateFor(draftPlanReport);
  const checks = [
    dataCheck(dataCounts),
    qaCheck(qaReport),
    draftPlanMatchCheck(draftPlanReport, options.minimumMatches),
    rosterValidityCheck(planBatch),
    candidateShapeCheck(draftPlanReport),
  ];
  const summary = checkSummary(checks);
  return {
    status: overallStatus(summary),
    recommendedExitCode: summary.hardFailCount > 0 ? 1 : 0,
    options,
    summary,
    checks,
    dataCounts,
    qa: {
      status: qaReport.status,
      recommendedExitCode: qaReport.recommendedExitCode,
      hardFailCount: qaReport.summary.hardFailCount,
      hardWarnCount: qaReport.summary.hardWarnCount,
    },
    draftPlan: {
      engineMode: draftPlanReport.engineMode,
      runCount: draftPlanReport.runCount,
      matchedRunCount: draftPlanReport.matchedRunCount,
      candidateLimit: draftPlanReport.candidateLimit,
      ...(topCandidate === undefined ? {} : { topCandidate }),
    },
  };
};
