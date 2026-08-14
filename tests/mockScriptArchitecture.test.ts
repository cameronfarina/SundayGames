import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const moduleDirectory = path.resolve("src/modeling/mockScript");

describe("mock script architecture", () => {
  it("keeps parsing responsibilities in focused modules", () => {
    const files = [
      path.resolve("src/modeling/mockScript.ts"),
      ...readdirSync(moduleDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(moduleDirectory, name)),
    ];

    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(150);
    }
  });
});
