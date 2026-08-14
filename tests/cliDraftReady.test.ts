import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI draft readiness", () => {
  it("prints a draft-day readiness report with QA and team-plan checks", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "draft:ready",
        "--",
        "--owner=Owner11",
        "--strategy=three-rb",
        "--scenario=expected",
        "--runs=4",
        "--qa-runs=10",
        "--limit=2",
        "--strategy-mode=force",
        "--min-matches=1",
        "--seed-prefix=draft-ready-cli-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      status: string;
      recommendedExitCode: number;
      options: {
        owner: string;
        strategyKey: string;
        strategyMode: string;
        scenarioKey: string;
        runs: number;
        qaRuns: number;
        engineMode: string;
        minimumMatches: number;
      };
      summary: {
        hardFailCount: number;
      };
      checks: {
        key: string;
        status: string;
        severity: string;
      }[];
      draftPlan: {
        engineMode: string;
        runCount: number;
        matchedRunCount: number;
        topCandidate?: {
          rbCore: string[];
        };
      };
      qa: {
        recommendedExitCode: number;
      };
    };

    expect(["pass", "warn"]).toContain(report.status);
    expect(report.recommendedExitCode).toBe(0);
    expect(report.options).toMatchObject({
      owner: "Owner11",
      strategyKey: "three-rb",
      strategyMode: "force",
      scenarioKey: "expected",
      runs: 4,
      qaRuns: 10,
      engineMode: "fast",
      minimumMatches: 1,
    });
    expect(report.summary.hardFailCount).toBe(0);
    expect(report.qa.recommendedExitCode).toBe(0);
    expect(report.checks.map(check => check.key)).toEqual([
      "data-inputs",
      "qa",
      "draft-plan-matches",
      "roster-validity",
      "top-candidate-shape",
    ]);
    expect(report.checks.every(check => check.severity === "hard")).toBe(true);
    expect(report.draftPlan).toMatchObject({
      engineMode: "fast",
      runCount: 4,
    });
    expect(report.draftPlan.matchedRunCount).toBeGreaterThan(0);
    expect(report.draftPlan.topCandidate?.rbCore).toHaveLength(3);
  }, 30000);

  it("accepts balanced as a draft readiness strategy", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "draft:ready",
        "--",
        "--owner=Owner11",
        "--strategy=balanced",
        "--scenario=expected",
        "--runs=3",
        "--qa-runs=4",
        "--limit=2",
        "--strategy-mode=force",
        "--min-matches=1",
        "--seed-prefix=draft-ready-balanced-cli-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      recommendedExitCode: number;
      options: {
        strategyKey: string;
      };
      draftPlan: {
        matchedRunCount: number;
        topCandidate?: {
          rbCore: string[];
        };
      };
    };

    expect(report.recommendedExitCode).toBe(0);
    expect(report.options.strategyKey).toBe("balanced");
    expect(report.draftPlan.matchedRunCount).toBeGreaterThan(0);
    expect(report.draftPlan.topCandidate?.rbCore.length).toBeGreaterThanOrEqual(1);
  }, 30000);
});
