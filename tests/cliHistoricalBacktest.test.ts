import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const backtestSchema = z.object({
  method: z.string(),
  historicalSeasons: z.array(z.number()),
  summary: z.object({
    status: z.string(),
    credible: z.boolean(),
    seasonCount: z.number(),
    failCount: z.number(),
  }),
  seasonBacktests: z.array(z.object({
    season: z.number(),
    sourceSeasons: z.array(z.number()),
    actual: z.object({ openAuctionSpend: z.number() }),
  })),
});

describe("CLI historical backtest", () => {
  it("prints a leave-one-season-out backtest for league economics", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      ["run", "--silent", "backtest"],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const report = backtestSchema.parse(JSON.parse(stdout));

    expect(report.method).toBe("leave-one-season-out");
    expect(report.historicalSeasons).toEqual([2023, 2024, 2025]);
    expect(["pass", "warn", "fail"]).toContain(report.summary.status);
    expect(report.summary).toMatchObject({
      credible: true,
      seasonCount: 3,
      failCount: 0,
    });
    expect(report.seasonBacktests.map(backtest => backtest.season)).toEqual([2023, 2024, 2025]);
    expect(report.seasonBacktests.find(backtest => backtest.season === 2025)).toMatchObject({
      sourceSeasons: [2023, 2024],
      actual: {
        openAuctionSpend: 2621,
      },
    });
  }, 15000);
});
