import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parsePlayerContextEvidenceCsv } from "../src/data/playerContextEvidenceImports.js";

const execFileAsync = promisify(execFile);
const evidenceResultSchema = z.object({
  evidence: z.array(z.object({
    player: z.string(),
    provider: z.string().optional(),
    sourceDate: z.string().optional(),
    sourceQuality: z.string().optional(),
  })),
});

describe("CLI player evidence adapter", () => {
  it("prints canonical CSV from a completed local evidence export", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-adapt-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,provider,source_date,source_quality,priority,rank",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,FantasyPros,2026-07-15,primary,high,11",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:adapt",
        "--",
        `--input=${inputPath}`,
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.trim()).toBe([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,FantasyPros,2026-07-15,primary",
    ].join("\n"));
    expect(parsePlayerContextEvidenceCsv(stdout)).toEqual([
      expect.objectContaining({
        player: "Drake London",
        category: "opportunity",
        adjustedSignal: 0.9,
        provider: "FantasyPros",
        sourceDate: "2026-07-15",
        sourceQuality: "primary",
      }),
    ]);
  }, 15000);

  it("prints canonical JSON with provenance metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-adapt-json-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,provider,source_date,source_quality,priority,rank",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,FantasyPros,2026-07-15,primary,high,11",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:adapt",
        "--",
        `--input=${inputPath}`,
        "--format=json",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = evidenceResultSchema.parse(JSON.parse(stdout));

    expect(result.evidence).toEqual([
      expect.objectContaining({
        player: "Drake London",
        provider: "FantasyPros",
        sourceDate: "2026-07-15",
        sourceQuality: "primary",
      }),
    ]);
  }, 15000);

  it("skips untouched template rows when printing canonical CSV", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-adapt-template-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank,research_prompt",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,high,11,Check targets",
      "Drake London,defensiveAttention,,,,,high,11,Check coverage",
      "Puka Nacua,risk,,,,,medium,8,Check injury history",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:adapt",
        "--",
        `--input=${inputPath}`,
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.trim()).toBe([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,,,",
    ].join("\n"));
  }, 15000);

  it("prints only the canonical header when no template rows are completed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-adapt-blank-template-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank,research_prompt",
      "Drake London,opportunity,,,,,high,11,Check targets",
      "Puka Nacua,risk,,,,,medium,8,Check injury history",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:adapt",
        "--",
        `--input=${inputPath}`,
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.trim()).toBe("player,category,score,confidence,source,note,provider,source_date,source_quality");
  }, 15000);
});
