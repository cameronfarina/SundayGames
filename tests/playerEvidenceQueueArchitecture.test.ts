import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/modeling/playerEvidenceQueue");

describe("player evidence queue architecture", () => {
  it("keeps queue policy and serialization in focused modules", () => {
    const files = [
      path.resolve("src/modeling/playerEvidenceQueue.ts"),
      ...readdirSync(directory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(directory, name)),
    ];

    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
    }
  });
});
