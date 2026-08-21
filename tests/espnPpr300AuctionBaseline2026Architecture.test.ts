import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("src/data/espnPpr300AuctionBaseline2026");
const files = [
  path.resolve("src/data/espnPpr300AuctionBaseline2026.ts"),
  ...readdirSync(root)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(root, name)),
];

describe("ESPN PPR baseline architecture", () => {
  it("keeps each source module focused", () => {
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
    }
  });
});
