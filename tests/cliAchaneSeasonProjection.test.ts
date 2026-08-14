import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const auditSchema = z.object({
  player: z.object({
    seasonProjection: z.number(),
    projectionCalibration: z.object({
      provider: z.string(),
      sourceDate: z.string(),
      sourceUrl: z.string(),
      baselineSeasonProjection: z.number(),
      calibratedSeasonProjection: z.number(),
      weeklyScaleFactor: z.number(),
      scoringBreakdown: z.object({ total: z.number() }),
    }),
  }),
  pricing: z.object({ projectionRank: z.number(), basePrice: z.number() }),
  explanation: z.array(z.string()),
});

describe("Achane player audit", () => {
  it("explains the season-long projection calibration before pricing", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=De'Von Achane",
        "--scenario=expected",
        "--runs=1",
        "--seed-prefix=achane-season-line-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = auditSchema.parse(JSON.parse(stdout));

    expect(result.player.seasonProjection).toBe(216.95);
    expect(result.player.projectionCalibration).toMatchObject({
      provider: "Oddschecker and FantasyPros",
      sourceDate: "2026-08-13",
      sourceUrl: "https://www.oddschecker.com/us/football/nfl-specials/devon-achane",
      baselineSeasonProjection: 260.39769621,
      calibratedSeasonProjection: 216.95,
      scoringBreakdown: { total: 216.95 },
    });
    expect(result.player.projectionCalibration.weeklyScaleFactor).toBeCloseTo(
      216.95 / 260.39769621,
      8,
    );
    expect(result.pricing.projectionRank).toBeGreaterThan(0);
    expect(result.pricing.basePrice).toBeGreaterThan(0);
    expect(result.explanation.join("\n")).toContain("Oddschecker and FantasyPros");
    expect(result.explanation.join("\n")).toContain("216.95");
  }, 15000);
});
