import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src", "modeling");

const productionFiles = (): string[] => {
  const files = [join(sourceRoot, "playerNews.ts")];
  const moduleRoot = join(sourceRoot, "playerNews");
  try {
    for (const entry of readdirSync(moduleRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(join(moduleRoot, entry.name));
      }
    }
  } catch {
    return files;
  }
  return files;
};

describe("player news architecture", () => {
  it("keeps every production module within the absolute line budget", () => {
    const sizes = productionFiles().map(file => ({
      file,
      lines: readFileSync(file, "utf8").split("\n").length,
    }));

    expect(sizes.filter(({ lines }) => lines > 250)).toEqual([]);
  });
});
