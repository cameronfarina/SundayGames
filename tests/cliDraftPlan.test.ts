import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const draftPlanSchema = z.object({
  owner: z.string(),
  strategy: z.object({ key: z.string() }),
  engineMode: z.string(),
  runCount: z.number(),
  matchedRunCount: z.number(),
  candidateLimit: z.number(),
  recommendations: z.object({
    strategyCoach: z.object({
      headline: z.string(),
      blueprint: z.array(z.object({
        slot: z.string(),
        priceBand: z.string(),
        targetNames: z.array(z.string()),
      })),
      contingencyPlans: z.array(z.object({ label: z.string(), action: z.string() })),
    }),
    maxPriceBands: z.array(z.object({ slot: z.string(), maximumPrice: z.number() })),
    pivotRules: z.array(z.object({ label: z.string(), action: z.string() })),
  }),
  candidates: z.array(z.object({
    owner: z.string(),
    rbCore: z.array(z.object({ name: z.string(), price: z.number() })),
    players: z.array(z.object({ position: z.string(), price: z.number() })),
  })),
});

describe("CLI draft plan report", () => {
  it("prints owner-specific draft plans from real mock batches", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "teams",
        "--",
        "--owner=Owner11",
        "--strategy=three-rb",
        "--scenario=expected",
        "--runs=8",
        "--limit=3",
        "--strategy-mode=force",
        "--seed-prefix=cli-draft-plan-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = draftPlanSchema.parse(JSON.parse(stdout));

    expect(report.owner).toBe("Owner11");
    expect(report.strategy.key).toBe("three-rb");
    expect(report.engineMode).toBe("fast");
    expect(report.runCount).toBe(8);
    expect(report.matchedRunCount).toBeGreaterThan(0);
    expect(report.candidateLimit).toBe(3);
    expect(report.recommendations.maxPriceBands).toEqual(expect.arrayContaining([
      expect.objectContaining({ slot: "RB1", maximumPrice: 76 }),
      expect.objectContaining({ slot: "RB2", maximumPrice: 76 }),
      expect.objectContaining({ slot: "RB3", maximumPrice: 48 }),
    ]));
    expect(report.recommendations.pivotRules[0]).toEqual(expect.objectContaining({
      label: "RB budget envelope",
      action: expect.stringContaining("third RB flex down"),
    }));
    expect(report.recommendations.strategyCoach.headline).toContain("sampled");
    expect(report.recommendations.strategyCoach.blueprint).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: "RB1",
        priceBand: expect.stringMatching(/^\$\d+-\$\d+$/),
        targetNames: expect.any(Array),
      }),
      expect.objectContaining({
        slot: "WR1",
        targetNames: expect.any(Array),
      }),
    ]));
    expect(report.recommendations.strategyCoach.contingencyPlans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "After elite RB spend",
      }),
    ]));
    expect(report.candidates.length).toBeGreaterThan(0);
    for (const candidate of report.candidates) {
      expect(candidate.owner).toBe("Owner11");
      expect(candidate.rbCore).toHaveLength(3);
      expect(candidate.rbCore[0]?.price).toBeGreaterThanOrEqual(50);
      expect(candidate.rbCore[1]?.price).toBeGreaterThanOrEqual(35);
      expect(candidate.rbCore[2]?.price).toBeGreaterThanOrEqual(12);
      const paidReceivers = candidate.players
        .filter(player => player.position === "WR")
        .sort((left, right) => right.price - left.price);
      expect(paidReceivers[0]?.price).toBeGreaterThanOrEqual(6);
      expect(paidReceivers[1]?.price).toBeGreaterThanOrEqual(5);
      const rbDepth = candidate.players
        .filter(player => player.position === "RB")
        .sort((left, right) => right.price - left.price)
        .slice(3);
      expect(rbDepth.every(player => player.price <= 8)).toBe(true);
    }
  }, 30000);

  it("prints compact CSV draft plans for spreadsheet comparison", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "teams",
        "--",
        "--owner=Owner11",
        "--strategy=three-rb",
        "--scenario=expected",
        "--runs=4",
        "--limit=2",
        "--strategy-mode=force",
        "--format=csv",
        "--seed-prefix=cli-draft-plan-csv-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const lines = stdout.trim().split("\n");
    expect(lines[0]).toBe(
      "rank,seed,scenario,owner,strategy,engine_mode,roster_spend,budget_remaining,week1_score,weeks1_to_4_score,rb_core_spend,rb1,rb1_price,rb2,rb2_price,rb3,rb3_price,wr1,wr1_price,wr2,wr2_price,te,te_price,k,k_price,dst,dst_price,lineup,bench,roster",
    );
    expect(lines.length).toBeGreaterThan(1);

    const firstRow = lines[1]?.split(",") ?? [];
    expect(firstRow[3]).toBe("Owner11");
    expect(firstRow[5]).toBe("fast");
    expect(Number(firstRow[6])).toBeLessThanOrEqual(200);
    expect(Number(firstRow[12])).toBeGreaterThanOrEqual(50);
    expect(Number(firstRow[14])).toBeGreaterThanOrEqual(35);
    expect(Number(firstRow[16])).toBeGreaterThanOrEqual(12);
    expect(firstRow[27]).toContain("RB1:");
  }, 30000);

  it("prints markdown draft path recommendations for fast prep reading", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "teams",
        "--",
        "--owner=Owner11",
        "--strategy=three-rb",
        "--scenario=expected",
        "--runs=8",
        "--limit=1",
        "--strategy-mode=force",
        "--format=markdown",
        "--seed-prefix=cli-draft-plan-markdown-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    expect(stdout).toContain("## Path Recommendations");
    expect(stdout).toContain("## Strategy Coach");
    expect(stdout).toContain("Blueprint:");
    expect(stdout).toContain("Contingencies:");
    expect(stdout).toContain("Max bands: RB1 $50-$76");
    expect(stdout).toContain("Targets: RB core");
    expect(stdout).toContain("Pivots: RB budget envelope");
    expect(stdout).toContain("Dead zones: none");
  }, 30000);
});
