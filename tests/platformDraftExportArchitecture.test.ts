import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/draftExport");
const files = [
  path.resolve("src/platform/draftExport.ts"),
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
];

describe("draft export architecture", () => {
  it("keeps export modules focused", () => {
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
    }
  });
});
