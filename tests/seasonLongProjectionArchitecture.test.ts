import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/modeling/seasonLongProjection");
const files = [
  path.resolve("src/modeling/seasonLongProjection.ts"),
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
];

describe("season-long projection architecture", () => {
  it("keeps projection modules focused", () => {
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(150);
    }
  });
});
