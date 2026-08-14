import { describe, expect, it } from "vitest";
import {
  buildQaReport,
  type BuildQaReportOptions,
  type QaGateSummaryInput,
} from "../src/modeling/qaReport.js";

const gateSummary = (
  status: QaGateSummaryInput["status"] = "pass",
): QaGateSummaryInput => ({
  status,
  credible: true,
  gateCount: 1,
  passCount: status === "pass" ? 1 : 0,
  warnCount: status === "warn" ? 1 : 0,
  failCount: status === "fail" ? 1 : 0,
});

const reportOptions = (): BuildQaReportOptions => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario: 1,
    seedPrefix: "qa-policy",
  },
  smoke: {
    invalidRosterCount: 0,
    firstTwoRoundSummary: { pickCount: 14 },
    warnings: [],
  },
  calibration: {
    gates: { summary: gateSummary(), items: [] },
  },
  backtest: { summary: gateSummary() },
});

describe("QA report status policies", () => {
  it("passes and recommends success when every hard gate passes", () => {
    const report = buildQaReport(reportOptions());

    expect(report.status).toBe("pass");
    expect(report.recommendedExitCode).toBe(0);
    expect(report.summary).toEqual({
      checkCount: 3,
      hardFailCount: 0,
      hardWarnCount: 0,
      advisoryFailCount: 0,
      advisoryWarnCount: 0,
    });
  });

  it("warns without blocking release for a smoke warning", () => {
    const input = reportOptions();
    input.smoke.warnings = ["Auction spend drifted."];
    input.artifactPaths = ["artifacts/qa.json"];

    const report = buildQaReport(input);

    expect(report.status).toBe("warn");
    expect(report.recommendedExitCode).toBe(0);
    expect(report.summary.hardWarnCount).toBe(1);
    expect(report.artifactPaths).toEqual(["artifacts/qa.json"]);
  });

  it("uses the hard-failure fallback when no early picks are produced", () => {
    const input = reportOptions();
    input.smoke.firstTwoRoundSummary.pickCount = 0;

    const report = buildQaReport(input);

    expect(report.status).toBe("fail");
    expect(report.recommendedExitCode).toBe(1);
    expect(report.checks[0]?.message).toBe("Smoke mock failed roster or early-round checks.");
  });

  it("treats a reported calibration warning as a non-blocking hard warning", () => {
    const input = reportOptions();
    input.calibration.gates.summary = gateSummary("warn");

    const report = buildQaReport(input);

    expect(report.status).toBe("warn");
    expect(report.recommendedExitCode).toBe(0);
    expect(report.summary.hardWarnCount).toBe(1);
  });

  it("blocks release when a gate reports failure without a failed count", () => {
    const input = reportOptions();
    input.backtest.summary = {
      ...gateSummary(),
      status: "fail",
      passCount: 1,
      failCount: 0,
    };

    expect(buildQaReport(input).recommendedExitCode).toBe(1);
  });

  it("blocks release when a gate has a failed count despite a passing status", () => {
    const input = reportOptions();
    input.backtest.summary = {
      ...gateSummary(),
      passCount: 0,
      failCount: 1,
    };

    expect(buildQaReport(input).recommendedExitCode).toBe(1);
  });

  it("keeps advisory warnings non-blocking and defaults missing provenance to zero", () => {
    const input = reportOptions();
    input.evidenceCoverage = {
      summary: {
        status: "warn",
        highPriorityMissingCount: 1,
        missingEvidenceCount: 2,
        coverageRate: 0.8,
        completeEvidenceRate: 0.8,
      },
      gates: { summary: gateSummary("warn") },
    };

    const report = buildQaReport(input);

    expect(report.status).toBe("warn");
    expect(report.recommendedExitCode).toBe(0);
    expect(report.summary.advisoryWarnCount).toBe(1);
    expect(report.checks.at(-1)?.message).toContain("0 evidence row(s)");
  });
});
