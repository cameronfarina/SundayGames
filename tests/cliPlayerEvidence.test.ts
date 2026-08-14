import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const cliPriceResultSchema = z.object({
  config: z.object({
    playerContext: z.object({
      enabled: z.boolean(),
      evidencePath: z.string().optional(),
    }),
  }),
  prices: z.array(z.object({
    name: z.string(),
    contextSignals: z.record(z.string(), z.number()).optional(),
    contextNotes: z.record(z.string(), z.string()).optional(),
    contextEvidence: z.array(z.unknown()).optional(),
  })),
});

describe("CLI player evidence imports", () => {
  it("loads the checked-in 2026 evidence file by default", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      ["run", "--silent", "prices"],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = cliPriceResultSchema.parse(JSON.parse(stdout));
    const london = result.prices.find(price => price.name === "Drake London");

    expect(result.config.playerContext.enabled).toBe(true);
    expect(result.config.playerContext.evidencePath).toBe("data/raw/player-evidence-2026-initial.csv");
    expect(london?.contextSignals).toMatchObject({
      opportunity: 0.8,
      defensiveAttention: -0.325,
      skillFit: -0.35,
      environment: -0.8,
      risk: -0.85,
    });
    expect(london?.contextEvidence).toHaveLength(5);
  }, 15000);

  it("can opt out of default evidence for raw pricing baselines", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      ["run", "--silent", "prices", "--", "--no-default-evidence"],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = cliPriceResultSchema.parse(JSON.parse(stdout));
    const london = result.prices.find(price => price.name === "Drake London");

    expect(result.config.playerContext.enabled).toBe(false);
    expect(result.config.playerContext.evidencePath).toBeUndefined();
    expect(london?.contextEvidence).toBeUndefined();
  }, 15000);

  it("uses sourced evidence rows as auditable pricing context", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-"));
    const evidencePath = join(directory, "evidence.csv");
    await writeFile(evidencePath, [
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Drake London,opportunity,1,1,targets,Target volume remains strong,FantasyPros,2026-07-15,primary",
      "Drake London,defensiveAttention,-1,0.8,coverage,More WR1 defensive attention",
      "Drake London,skillFit,-0.5,1,separation,Separation profile trims upside",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      ["run", "--silent", "prices", "--", `--player-evidence=${evidencePath}`],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = cliPriceResultSchema.parse(JSON.parse(stdout));
    const london = result.prices.find(price => price.name === "Drake London");

    expect(result.config.playerContext.enabled).toBe(true);
    expect(result.config.playerContext.evidencePath).toBe(evidencePath);
    expect(london?.contextSignals).toMatchObject({
      opportunity: 1,
      defensiveAttention: -0.8,
      skillFit: -0.5,
    });
    expect(london?.contextNotes).toMatchObject({
      defensiveAttention: "coverage: More WR1 defensive attention",
    });
    expect(london?.contextEvidence).toHaveLength(3);
    expect(london?.contextEvidence).toContainEqual(expect.objectContaining({
      category: "opportunity",
      provider: "FantasyPros",
      sourceDate: "2026-07-15",
      sourceQuality: "primary",
    }));
  });
});
