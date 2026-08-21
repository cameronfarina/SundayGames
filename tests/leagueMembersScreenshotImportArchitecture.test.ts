import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("league member screenshot import architecture", () => {
  it("keeps production modules within the file budget", () => {
    const root = join(process.cwd(), "src/platform/leagueMembersScreenshotImport");
    const facade = join(process.cwd(), "src/platform/leagueMembersScreenshotImport.ts");
    const modules = readdirSync(root).map(entry => join(root, entry));

    for (const file of [facade, ...modules]) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(250);
    }
  });
});
