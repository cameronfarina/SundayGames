import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const platformRoot = new URL("../src/platform", import.meta.url);

const sourceFiles = async (): Promise<string[]> => {
  const directory = join(platformRoot.pathname, "leagueSeason");
  const modules = await readdir(directory).catch(() => []);
  return [
    join(platformRoot.pathname, "leagueSeason.ts"),
    ...modules.filter(name => name.endsWith(".ts")).map(name => join(directory, name)),
  ];
};

describe("league season architecture", () => {
  it("uses focused modules without unsafe TypeScript escapes", async () => {
    const files = await sourceFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      expect(source, file).not.toMatch(/\bany\b|@ts-ignore|@ts-expect-error|eslint-disable/);
      expect(source, file).not.toMatch(/\bas\s+(?:const|never|unknown|any|[A-Z][A-Za-z0-9_<>,.\[\] |&]*)/);
    }
  });
});
