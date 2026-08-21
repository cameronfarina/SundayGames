import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("../src/modeling", import.meta.url);

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name === "historicalBacktest.ts")
    .map(entry => join(root.pathname, entry.name));
  const directory = entries.find(entry => entry.isDirectory() && entry.name === "historicalBacktest");
  if (!directory) return files;
  const modules = await readdir(join(root.pathname, directory.name));
  return [...files, ...modules.filter(name => name.endsWith(".ts")).map(name => join(root.pathname, directory.name, name))];
};

describe("historical backtest architecture", () => {
  it("keeps every production module focused and free of TypeScript escape hatches", async () => {
    const files = await productionFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(250);
      expect(source, file).not.toMatch(/\bas\s+(?:const|never|unknown|any|[A-Z][A-Za-z0-9_<>,.\[\] |&]*)/);
      expect(source, file).not.toMatch(/\bany\b|@ts-ignore|@ts-expect-error|eslint-disable/);
    }
  });
});
