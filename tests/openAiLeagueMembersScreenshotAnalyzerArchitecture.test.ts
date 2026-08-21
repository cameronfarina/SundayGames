import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("screenshot analyzer architecture", () => {
  it("keeps the optional provider boundary focused", () => {
    const root = join(process.cwd(), "src/platform/openAiLeagueMembersScreenshotAnalyzer");
    const facade = join(process.cwd(), "src/platform/openAiLeagueMembersScreenshotAnalyzer.ts");
    const modules = readdirSync(root).map(entry => join(root, entry));
    for (const file of [facade, ...modules]) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(250);
    }
  });
});
