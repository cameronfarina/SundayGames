import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  moduleSizeWarning,
  physicalLineCount,
  preferredProductionModuleLines,
  productionModuleSizeWarnings,
} from "../scripts/check-module-size-guideline.js";

const testsRoot = join(process.cwd(), "tests");
const thisTest = "tests/moduleSizeGuideline.test.ts";
const blockingPreferredLimitPatterns = [
  /toBeLessThanOrEqual\(150\)/u,
  /(?:lines|lineCount|length)\s*>\s*150/u,
  /(?:exceeds|maximum is) 150/u,
  /preferredMaximumLines\s*=\s*150/u,
];

const testFilesWithin = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testFilesWithin(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });

describe("production module size policy", () => {
  it("does not make the preferred 150-line guideline a test failure", () => {
    const blockingChecks = testFilesWithin(testsRoot).flatMap(file => {
      const label = relative(process.cwd(), file);
      if (label === thisTest) return [];
      const source = readFileSync(file, "utf8");
      return blockingPreferredLimitPatterns.some(pattern => pattern.test(source)) ? [label] : [];
    });

    expect(blockingChecks).toEqual([]);
  });

  it("reports production modules over 150 lines without throwing", () => {
    expect(preferredProductionModuleLines).toBe(150);
    expect(physicalLineCount("first\nsecond\n")).toBe(2);
    expect(moduleSizeWarning("src/large.ts", 150)).toBeUndefined();
    expect(moduleSizeWarning("src/large.ts", 151)).toEqual({
      file: "src/large.ts",
      lines: 151,
    });
    expect(() => productionModuleSizeWarnings(process.cwd())).not.toThrow();
  });
});
