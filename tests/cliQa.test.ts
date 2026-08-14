import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const qaReportSchema = z.object({
  status: z.string(),
  recommendedExitCode: z.number(),
  options: z.object({
    scenarioKeys: z.array(z.string()),
    runsPerScenario: z.number(),
    seedPrefix: z.string(),
  }),
  summary: z.object({ hardFailCount: z.number() }),
  checks: z.array(z.object({
    key: z.string(),
    severity: z.string(),
    status: z.string(),
  })),
  artifactPaths: z.array(z.string()),
});

describe("CLI QA", () => {
  it("prints the blessed engine QA report", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "qa",
        "--",
        "--scenarios=expected",
        "--seed-prefix=qa-cli-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = qaReportSchema.parse(JSON.parse(stdout));

    expect(["pass", "warn"]).toContain(report.status);
    expect(report.recommendedExitCode).toBe(0);
    expect(report.options).toMatchObject({
      scenarioKeys: ["expected"],
      runsPerScenario: 50,
      seedPrefix: "qa-cli-test",
    });
    expect(report.summary.hardFailCount).toBe(0);
    expect(report.checks.map(check => check.key)).toEqual([
      "smoke",
      "calibration",
      "backtest",
      "evidence-coverage",
    ]);
    expect(report.checks.find(check => check.key === "evidence-coverage")?.severity).toBe("advisory");
    expect(report.artifactPaths).toEqual([]);
  }, 60000);
});
