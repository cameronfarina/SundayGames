import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const contractsDirectory = path.resolve("src/platform/auction/contracts");
const files = [
  path.resolve("src/platform/auction/types.ts"),
  ...readdirSync(contractsDirectory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(contractsDirectory, name)),
];

describe("auction contracts architecture", () => {
  it("keeps each contract module focused", () => {
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
    }
  });
});
