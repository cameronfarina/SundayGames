import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const priceReportSchema = z.object({
  config: z.object({
    playerContext: z.object({
      enabled: z.boolean(),
      overrideCount: z.number(),
      importPath: z.string().optional(),
    }),
  }),
  prices: z.array(z.object({
    name: z.string(),
    contextAdjustmentFactor: z.number(),
    contextSignals: z.record(z.string(), z.number()),
    contextNotes: z.record(z.string(), z.string()).optional(),
  })),
});

describe("CLI player context imports", () => {
  it("uses imported player context files in custom pricing commands", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-context-"));
    const contextPath = join(directory, "context.csv");
    await writeFile(contextPath, [
      "player,role,injury,role_note",
      "Puka Nacua,-2,-1,Imported workload concern",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      ["run", "--silent", "prices", "--", `--player-context=${contextPath}`],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = priceReportSchema.parse(JSON.parse(stdout));
    const puka = result.prices.find(price => price.name === "Puka Nacua");

    expect(result.config.playerContext.enabled).toBe(true);
    expect(result.config.playerContext.importPath).toBe(contextPath);
    expect(result.config.playerContext.overrideCount).toBeGreaterThan(10);
    expect(puka?.contextSignals).toMatchObject({
      role: -2,
      injury: -1,
    });
    expect(puka?.contextNotes).toMatchObject({
      role: "Imported workload concern",
    });
    expect(puka?.contextAdjustmentFactor).toBeLessThan(1);
  });
});
