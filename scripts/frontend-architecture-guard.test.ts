import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  frontendArchitectureWarnings,
  frontendArchitectureViolations,
  frontendLineCount,
  frontendMaximumLines,
  frontendPreferredLines,
} from "./frontend-architecture-guard.js";

describe("frontend architecture guard", () => {
  it("counts empty, trailing-newline, and CRLF files by physical line", () => {
    expect(frontendLineCount("")).toBe(0);
    expect(frontendLineCount("one\n")).toBe(1);
    expect(frontendLineCount("one\r\ntwo\r\n")).toBe(2);
  });

  it("reports frontend source files above the hard line limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "mockd-frontend-guard-"));
    const sourceDirectory = join(root, "web", "src", "features");
    await mkdir(sourceDirectory, { recursive: true });
    const oversizedSource = Array.from(
      { length: frontendMaximumLines + 1 },
      (_, index) => `export const line${String(index)} = ${String(index)};`,
    ).join("\n");
    await writeFile(join(sourceDirectory, "Oversized.ts"), oversizedSource);

    await expect(frontendArchitectureViolations(root)).resolves.toEqual([
      { file: "web/src/features/Oversized.ts", lines: frontendMaximumLines + 1 },
    ]);
  });

  it("warns when a frontend file crosses the preferred line limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "mockd-frontend-guard-"));
    const sourceDirectory = join(root, "web", "src", "features");
    await mkdir(sourceDirectory, { recursive: true });
    const source = Array.from(
      { length: frontendPreferredLines + 1 },
      (_, index) => `export const line${String(index)} = ${String(index)};`,
    ).join("\n");
    await writeFile(join(sourceDirectory, "Large.ts"), source);

    await expect(frontendArchitectureWarnings(root)).resolves.toEqual([
      { file: "web/src/features/Large.ts", lines: frontendPreferredLines + 1 },
    ]);
  });
});
