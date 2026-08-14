import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const draftReadyReportSchema = z.object({
  status: z.string(),
  recommendedExitCode: z.number(),
  options: z.object({
    owner: z.string(),
    strategyKey: z.string(),
    strategyMode: z.string(),
    scenarioKey: z.string(),
    runs: z.number(),
    qaRuns: z.number(),
    engineMode: z.string(),
    minimumMatches: z.number(),
  }),
  summary: z.object({ hardFailCount: z.number() }),
  checks: z.array(z.object({
    key: z.string(),
    status: z.string(),
    severity: z.string(),
  })),
  draftPlan: z.object({
    engineMode: z.string(),
    runCount: z.number(),
    matchedRunCount: z.number(),
    topCandidate: z.object({ rbCore: z.array(z.string()) }).optional(),
  }),
  qa: z.object({ recommendedExitCode: z.number() }),
});

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
    const report = draftReadyReportSchema.parse(JSON.parse(stdout));

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
    const report = draftReadyReportSchema.parse(JSON.parse(stdout));

    expect(report.recommendedExitCode).toBe(0);
    expect(report.options.strategyKey).toBe("balanced");
    expect(report.draftPlan.matchedRunCount).toBeGreaterThan(0);
    expect(report.draftPlan.topCandidate?.rbCore.length).toBeGreaterThanOrEqual(1);
  }, 30000);
});
