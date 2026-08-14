import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const sessionStoreRoot = join(sourceRoot, "liveDraftSessionStore");

const productionFiles = async (): Promise<string[]> => {
  const subtreeEntries = await readdir(sessionStoreRoot, { withFileTypes: true }).catch(() => []);
  const subtreeFiles = subtreeEntries
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
    .map(entry => join(sessionStoreRoot, entry.name));
  return [join(sourceRoot, "liveDraftSessionStore.ts"), ...subtreeFiles];
};

const prohibitedNodeCount = (path: string, source: string): number => {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      node.kind === ts.SyntaxKind.AnyKeyword
    ) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
};

describe("live draft session store architecture", () => {
  it("keeps production modules focused and free of unsafe type escapes", async () => {
    const files = await productionFiles();
    const sources = await Promise.all(files.map(path => readFile(path, "utf8")));

    for (const [index, source] of sources.entries()) {
      expect(source.split("\n").length, files[index]).toBeLessThanOrEqual(150);
      expect(prohibitedNodeCount(files[index] ?? "", source), files[index]).toBe(0);
      expect(source, files[index]).not.toMatch(/@ts-(?:ignore|expect-error)/);
    }
  });
});
