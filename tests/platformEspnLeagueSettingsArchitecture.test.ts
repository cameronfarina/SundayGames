import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src/platform/espnLeagueSettingsImport");

const sourceFiles = (directory: string): string[] => readdirSync(directory)
  .map(entry => join(directory, entry))
  .flatMap(path => statSync(path).isDirectory() ? sourceFiles(path) : [path])
  .filter(path => path.endsWith(".ts"));

describe("ESPN league settings import architecture", () => {
  it("keeps each production module focused", () => {
    const facade = join(process.cwd(), "src/platform/espnLeagueSettingsImport.ts");
    const files = [facade, ...sourceFiles(sourceRoot)];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, file).toBeLessThanOrEqual(250);
    }
  });
});
