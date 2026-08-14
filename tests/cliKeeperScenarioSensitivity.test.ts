import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const sensitivitySchema = z.object({
  summary: z.object({
    playerCount: z.number(),
    reportedPlayerCount: z.number(),
    truncated: z.boolean(),
    keeperRemovedCount: z.number(),
    scenarioKeys: z.array(z.string()),
    availabilityChangeCount: z.number(),
    unpricedKeeperCount: z.number(),
    keeperRemovalChangeCount: z.number(),
  }),
  rows: z.array(z.object({
    player: z.string(),
    pricedPool: z.boolean(),
    keeperRemoved: z.boolean(),
    keeperRemovalChanged: z.boolean(),
    availabilityChanged: z.boolean(),
    keeperRemovalScenarios: z.array(z.string()),
    priceSpread: z.number().nullable(),
    scenarios: z.object({
      confirmedOnly: z.object({ available: z.boolean() }),
      expected: z.object({
        available: z.boolean(),
        unavailableReason: z.string().optional(),
      }),
    }),
  })),
});

describe("CLI keeper scenario sensitivity", () => {
  it("prints JSON scenario sensitivity rows", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "scenarios:sensitivity",
        "--",
        "--limit=60",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const report = sensitivitySchema.parse(JSON.parse(stdout));

    expect(report.summary.scenarioKeys).toEqual(["confirmedOnly", "expected", "highRetention"]);
    expect(report.summary.playerCount).toBeGreaterThan(report.summary.reportedPlayerCount);
    expect(report.summary.reportedPlayerCount).toBe(60);
    expect(report.summary.truncated).toBe(true);
    expect(report.summary.keeperRemovedCount).toBeGreaterThan(report.summary.availabilityChangeCount);
    expect(report.summary.unpricedKeeperCount).toBe(0);
    expect(report.summary.availabilityChangeCount).toBeGreaterThan(0);
    expect(report.summary.keeperRemovalChangeCount).toBe(report.summary.availabilityChangeCount);
    expect(report.rows.some(row =>
      row.player === "Justin Jefferson" &&
      row.availabilityChanged &&
      row.scenarios.expected.available === false &&
      row.scenarios.expected.unavailableReason?.includes("assumed keeper"),
    )).toBe(true);
    expect(report.rows.some(row =>
      row.player === "Mark Andrews" &&
      row.pricedPool &&
      row.keeperRemoved &&
      row.keeperRemovalChanged &&
      row.availabilityChanged &&
      row.priceSpread === null &&
      row.keeperRemovalScenarios.join(",") === "expected,highRetention" &&
      row.scenarios.confirmedOnly.available &&
      row.scenarios.expected.unavailableReason === "Owner10 assumed keeper at $2",
    )).toBe(true);
  }, 15000);

  it("prints CSV scenario sensitivity rows", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "scenarios:sensitivity",
        "--",
        "--limit=60",
        "--format=csv",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.split("\n")[0]).toBe("rank,player,position,base_price,confirmed_only_available,confirmed_only_price,confirmed_only_factor,expected_available,expected_price,expected_factor,high_retention_available,high_retention_price,high_retention_factor,price_spread,expected_vs_confirmed_delta,high_retention_vs_expected_delta,keeper_removed,keeper_removal_scenarios,keeper_removal_changed,availability_changed,unavailable_scenarios,unavailable_reasons");
    expect(stdout).toContain("Justin Jefferson");
    expect(stdout).toContain("expected/highRetention: Owner04 assumed keeper at $42");
    expect(stdout).toContain("Mark Andrews");
    expect(stdout).toContain("expected/highRetention: Owner10 assumed keeper at $2");
  }, 15000);
});
