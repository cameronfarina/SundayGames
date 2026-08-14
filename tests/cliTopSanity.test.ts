import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI top-player sanity report", () => {
  it("scans the top auction players and flags review-worthy pricing signals", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "sanity",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=sanity-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      config: {
        scenarioKey: string;
        limit: number;
        runs: number;
      };
      summary: {
        reviewedCount: number;
        flaggedPlayerCount: number;
        flagCounts: Record<string, number>;
        highPriceVolume: {
          threshold: number;
          historicalMaxCount: number;
          scenarioCount: number;
          mockMaxCount: number;
          status: string;
        }[];
      };
      players: {
        rank: number;
        name: string;
        position: string;
        basePrice: number;
        scenarioPrice: number;
        averageMockSalePrice: number;
        saleVsScenarioPrice: number;
        contextEvidenceCount: number;
        flags: {
          key: string;
          severity: string;
          message: string;
        }[];
      }[];
      flaggedPlayers: {
        name: string;
        flags: {
          key: string;
        }[];
      }[];
    };

    expect(report.config).toMatchObject({
      scenarioKey: "expected",
      limit: 40,
      runs: 2,
    });
    expect(report.summary.reviewedCount).toBe(40);
    expect(report.players).toHaveLength(40);
    expect(report.players.map(player => player.rank)).toEqual(
      Array.from({ length: 40 }, (_value, index) => index + 1),
    );
    expect(report.players[0]?.scenarioPrice).toBeGreaterThanOrEqual(
      report.players[1]?.scenarioPrice ?? 0,
    );
    expect(report.summary.flaggedPlayerCount).toBeGreaterThan(0);
    expect(report.summary.flagCounts.highMockPremium).toBeGreaterThan(0);
    expect(report.summary.flagCounts.missingFactualEvidence).toBe(1);
    expect(report.summary.highPriceVolume.map(volume => volume.threshold)).toEqual([70, 75, 80]);
    expect(report.summary.highPriceVolume.every(volume =>
      ["pass", "review"].includes(volume.status),
    )).toBe(true);

    const london = report.players.find(player => player.name === "Drake London");
    expect(london).toBeDefined();
    expect(london?.scenarioPrice).toBeGreaterThan(0);
    expect(london?.averageMockSalePrice).toBeGreaterThan(0);
    expect(london?.saleVsScenarioPrice).toBeGreaterThanOrEqual(0);
    expect(london?.contextEvidenceCount).toBe(5);
    const londonFlagKeys = london?.flags.map(flag => flag.key) ?? [];
    expect(londonFlagKeys).toContain("largeProjectionRankLift");
    expect(londonFlagKeys).toContain("contextPenalty");
    expect(londonFlagKeys).not.toContain("missingFactualEvidence");

    const missingEvidenceFlag = report.flaggedPlayers.find(player =>
      player.flags.some(flag => flag.key === "missingFactualEvidence"),
    );
    expect(missingEvidenceFlag).toMatchObject({ name: "Jaxon Smith-Njigba" });
  }, 15000);
});
