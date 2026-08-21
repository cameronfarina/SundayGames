import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("league creation architecture", () => {
  it("keeps production modules focused", () => {
    const root = join(process.cwd(), "src/platform/leagueCreation");
    const facade = join(process.cwd(), "src/platform/leagueCreation.ts");
    const modules = readdirSync(root).map(entry => join(root, entry));

    for (const file of [facade, ...modules]) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(250);
    }
  });
});
