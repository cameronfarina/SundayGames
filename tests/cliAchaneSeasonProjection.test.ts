import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

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
    const result = JSON.parse(stdout) as {
      player: {
        seasonProjection: number;
        projectionCalibration: {
          provider: string;
          sourceDate: string;
          sourceUrl: string;
          baselineSeasonProjection: number;
          calibratedSeasonProjection: number;
          weeklyScaleFactor: number;
          scoringBreakdown: { total: number };
        };
      };
      pricing: {
        projectionRank: number;
        basePrice: number;
      };
      explanation: string[];
    };

    expect(result.player.seasonProjection).toBe(208.2);
    expect(result.player.projectionCalibration).toMatchObject({
      provider: "First Down Studio",
      sourceDate: "2026-08-12",
      sourceUrl: "https://www.firstdown.studio/season-rankings/flex",
      baselineSeasonProjection: 260.39769621,
      calibratedSeasonProjection: 208.2,
      scoringBreakdown: { total: 208.2 },
    });
    expect(result.player.projectionCalibration.weeklyScaleFactor).toBeCloseTo(
      208.2 / 260.39769621,
      8,
    );
    expect(result.pricing.projectionRank).toBeGreaterThan(0);
    expect(result.pricing.basePrice).toBeGreaterThan(0);
    expect(result.explanation.join("\n")).toContain("First Down Studio");
    expect(result.explanation.join("\n")).toContain("208.2");
  }, 15000);
});
