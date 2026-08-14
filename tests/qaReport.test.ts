import { describe, expect, it } from "vitest";
import {
  buildQaReport,
  type QaGateSummaryInput,
} from "../src/modeling/qaReport.js";

const passingGateSummary: QaGateSummaryInput = {
  status: "pass",
  credible: true,
  gateCount: 4,
  passCount: 4,
  warnCount: 0,
  failCount: 0,
};

describe("QA report", () => {
  it("keeps evidence coverage advisory while hard gates pass", () => {
    const report = buildQaReport({
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 2,
        seedPrefix: "qa-report-test",
      },
      smoke: {
        invalidRosterCount: 0,
        firstTwoRoundSummary: {
          pickCount: 28,
        },
        warnings: [],
      },
      calibration: {
        gates: {
          summary: passingGateSummary,
          items: [],
        },
      },
      backtest: {
        summary: passingGateSummary,
      },
      evidenceCoverage: {
        summary: {
          status: "fail",
          highPriorityMissingCount: 0,
          missingEvidenceCount: 8,
          provenanceIncompleteEvidenceCount: 0,
          coverageRate: 0.38,
          completeEvidenceRate: 0.38,
          provenanceCompleteEvidenceRate: 1,
        },
        gates: {
          summary: {
            ...passingGateSummary,
            status: "fail",
            credible: false,
            failCount: 2,
            passCount: 1,
          },
        },
      },
    });

    expect(report.status).toBe("warn");
    expect(report.recommendedExitCode).toBe(0);
    expect(report.summary).toMatchObject({
      hardFailCount: 0,
      advisoryFailCount: 1,
    });
    expect(report.checks.find(check => check.key === "evidence-coverage")).toMatchObject({
      status: "fail",
      severity: "advisory",
    });
  });

  it("calls out provenance gaps in the evidence coverage message", () => {
    const report = buildQaReport({
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 2,
        seedPrefix: "qa-report-test",
      },
      smoke: {
        invalidRosterCount: 0,
        firstTwoRoundSummary: {
          pickCount: 28,
        },
        warnings: [],
      },
      calibration: {
        gates: {
          summary: passingGateSummary,
          items: [],
        },
      },
      backtest: {
        summary: passingGateSummary,
      },
      evidenceCoverage: {
        summary: {
          status: "fail",
          highPriorityMissingCount: 0,
          missingEvidenceCount: 0,
          provenanceIncompleteEvidenceCount: 4,
          coverageRate: 1,
          completeEvidenceRate: 1,
          provenanceCompleteEvidenceRate: 0.5,
        },
        gates: {
          summary: {
            ...passingGateSummary,
            status: "fail",
            credible: false,
            failCount: 1,
            passCount: 3,
          },
        },
      },
    });

    expect(report.checks.find(check => check.key === "evidence-coverage")?.message)
      .toContain("4 evidence row(s) have incomplete provenance");
  });

  it("fails hard when calibration or backtest credibility fails", () => {
    const report = buildQaReport({
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 2,
        seedPrefix: "qa-report-test",
      },
      smoke: {
        invalidRosterCount: 0,
        firstTwoRoundSummary: {
          pickCount: 28,
        },
        warnings: [],
      },
      calibration: {
        gates: {
          summary: {
            ...passingGateSummary,
            status: "fail",
            credible: false,
            failCount: 1,
            passCount: 3,
          },
          items: [
            {
              key: "auction-spend",
              label: "Auction spend",
              status: "fail",
            },
          ],
        },
      },
      backtest: {
        summary: {
          ...passingGateSummary,
          status: "warn",
          credible: false,
          warnCount: 1,
          passCount: 3,
        },
      },
      evidenceCoverage: {
        summary: {
          status: "pass",
          highPriorityMissingCount: 0,
          missingEvidenceCount: 0,
          provenanceIncompleteEvidenceCount: 0,
          coverageRate: 1,
          completeEvidenceRate: 1,
          provenanceCompleteEvidenceRate: 1,
        },
        gates: {
          summary: passingGateSummary,
        },
      },
    });

    expect(report.status).toBe("fail");
    expect(report.recommendedExitCode).toBe(1);
    expect(report.summary.hardFailCount).toBe(2);
    expect(report.checks.filter(check => check.severity === "hard" && check.status === "fail"))
      .toHaveLength(2);
    expect(report.checks.find(check => check.key === "calibration")?.topItems[0]).toMatchObject({
      key: "auction-spend",
      status: "fail",
    });
  });

  it("fails hard when any smoke batch run has invalid rosters", () => {
    const report = buildQaReport({
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 2,
        seedPrefix: "qa-report-test",
      },
      smoke: {
        invalidRosterCount: 0,
        firstTwoRoundSummary: {
          pickCount: 28,
        },
        batch: {
          invalidRosterCount: 1,
        },
        warnings: ["1 invalid roster(s) in smoke batch."],
      },
      calibration: {
        gates: {
          summary: passingGateSummary,
          items: [],
        },
      },
      backtest: {
        summary: passingGateSummary,
      },
    });

    expect(report.status).toBe("fail");
    expect(report.recommendedExitCode).toBe(1);
    expect(report.checks.find(check => check.key === "smoke")).toMatchObject({
      status: "fail",
      severity: "hard",
    });
  });
});
