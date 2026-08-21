import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("top player sanity architecture", () => {
  it("keeps report modules focused", () => {
    const root = join(process.cwd(), "src/modeling/topPlayerSanity");
    const facade = join(process.cwd(), "src/modeling/topPlayerSanity.ts");
    const modules = readdirSync(root).map(entry => join(root, entry));
    for (const file of [facade, ...modules]) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(250);
    }
  });
});
