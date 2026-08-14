import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const modelingRoot = join(process.cwd(), "src/modeling");
const moduleRoot = join(modelingRoot, "keeperScenarioSensitivity");

const moduleFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
    .map(entry => join(moduleRoot, entry.name));
};

const forbiddenNodeCount = (file: string, source: string): number => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || node.kind === ts.SyntaxKind.AnyKeyword
    ) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
};

describe("keeper scenario sensitivity architecture", () => {
  it("uses focused modules without unsafe TypeScript escapes", async () => {
    const files = [
      join(modelingRoot, "keeperScenarioSensitivity.ts"),
      ...await moduleFiles(),
    ];
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      expect(forbiddenNodeCount(file, source), file).toBe(0);
      expect(source, file).not.toMatch(/@ts-(?:ignore|expect-error)|eslint-disable/);
    }
  });
});
