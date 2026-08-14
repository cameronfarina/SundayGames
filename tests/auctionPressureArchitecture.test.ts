import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/modeling/auctionEngine/pressure");
const files = [
  path.resolve("src/modeling/auctionEngine/pressure.ts"),
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
];

describe("auction pressure architecture", () => {
  it("keeps each pressure concern focused", () => {
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(150);
    }
  });
});
