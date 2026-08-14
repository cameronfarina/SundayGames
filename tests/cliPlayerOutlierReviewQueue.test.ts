import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const outlierQueueSchema = z.object({
  summary: z.object({
    playerCount: z.number(),
    highPriorityCount: z.number(),
    reasonCounts: z.record(z.string(), z.number()),
  }),
  rows: z.array(z.object({
    priority: z.string(),
    player: z.string(),
    scenarioPrice: z.number(),
    outlierReasons: z.array(z.object({ key: z.string(), message: z.string() })),
    auditCommand: z.string(),
    reviewStatus: z.string(),
  })),
});

describe("CLI player outlier review queue", () => {
  it("prints a prioritized top-player outlier queue", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "outliers:queue",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=outlier-cli-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const queue = outlierQueueSchema.parse(JSON.parse(stdout));

    expect(queue.summary.playerCount).toBeGreaterThan(0);
    expect(queue.summary.highPriorityCount).toBeGreaterThan(0);
    const totalReasonCount = Object.values(queue.summary.reasonCounts)
      .reduce((total, count) => total + count, 0);
    const rowReasonCount = queue.rows
      .reduce((total, row) => total + row.outlierReasons.length, 0);

    expect(totalReasonCount).toBeGreaterThan(0);
    expect(totalReasonCount).toBe(rowReasonCount);
    expect(queue.rows[0]).toMatchObject({
      priority: "high",
      reviewStatus: "open",
    });
    expect(queue.rows[0]?.scenarioPrice).toBeGreaterThan(0);
    expect(queue.rows[0]?.outlierReasons.length).toBeGreaterThan(0);
    expect(queue.rows[0]?.auditCommand).toContain("npm run audit -- --player=");

    expect(queue.rows.some(row =>
      row.outlierReasons.some(reason => reason.message.length > 0),
    )).toBe(true);
  }, 15000);

  it("prints the queue as CSV", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "outliers:queue",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=outlier-cli-csv-test",
        "--format=csv",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.split("\n")[0]).toBe("priority,rank,player,position,public_anchor_value,base_price,scenario_price,average_mock_sale_price,sale_vs_scenario_price,min_mock_sale_price,max_mock_sale_price,mock_sale_range,drafted_rate,rank_gap,context_adjustment_percent,current_evidence_count,primary_reason,outlier_reasons,thresholds,audit_command,review_status,review_note");
    expect(stdout).toContain("npm run audit -- --player=");
  }, 15000);
});
