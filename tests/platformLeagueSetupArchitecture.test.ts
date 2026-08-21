import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("league setup architecture", () => {
  it("keeps production modules focused", () => {
    const root = join(process.cwd(), "src/platform/leagueSetup");
    const facade = join(process.cwd(), "src/platform/leagueSetup.ts");
    const modules = readdirSync(root).map(entry => join(root, entry));

    for (const file of [facade, ...modules]) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(250);
      expect(source, file).not.toMatch(/\bany\b|@ts-ignore|@ts-expect-error|eslint-disable/u);
      expect(source, file).not.toMatch(
        /\bas\s+(?:const|never|unknown|any|[A-Z][A-Za-z0-9_<>,.\[\] |&]*)/u,
      );
    }
  });
});
