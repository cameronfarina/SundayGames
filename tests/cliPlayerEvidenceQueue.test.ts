import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const evidenceQueueSchema = z.object({
  summary: z.object({
    playerCount: z.number(),
    highPriorityCount: z.number(),
    categoryCounts: z.record(z.string(), z.number()),
  }),
  rows: z.array(z.object({
    player: z.string(),
    priority: z.string(),
    evidenceStatus: z.string(),
    currentEvidenceCount: z.number(),
    categories: z.array(z.string()),
    researchPrompts: z.array(z.string()),
  })),
});

describe("CLI player evidence queue", () => {
  it("prints a prioritized factual research queue from the top-player sanity report", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:queue",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=evidence-queue-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const queue = evidenceQueueSchema.parse(JSON.parse(stdout));

    expect(queue.summary.playerCount).toBeGreaterThan(0);
    expect(queue.summary.highPriorityCount).toBeGreaterThan(0);
    expect(queue.summary.categoryCounts.opportunity).toBeGreaterThan(0);

    const london = queue.rows.find(row => row.player === "Drake London");
    expect(london).toBeDefined();
    expect(london).toMatchObject({
      priority: "medium",
      evidenceStatus: "present",
      currentEvidenceCount: 5,
    });
    expect(london?.categories).toContain("opportunity");
    expect(london?.categories).toContain("defensiveAttention");
    expect(london?.researchPrompts.length).toBeGreaterThan(0);
  }, 15000);
});
