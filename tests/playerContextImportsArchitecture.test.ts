import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/data/playerContextImports");
const files = [
  path.resolve("src/data/playerContextImports.ts"),
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
];

describe("player-context imports architecture", () => {
  it("keeps each import module focused", () => {
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(150);
    }
  });
});
