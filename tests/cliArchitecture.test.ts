import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const cliRoot = join(process.cwd(), "src", "cli");

const sourceFiles = async (): Promise<string[]> => {
  const entries = await readdir(cliRoot, { recursive: true, withFileTypes: true });
  return [join(process.cwd(), "src", "cli.ts"), ...entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
    .map(entry => join(entry.parentPath, entry.name))];
};

const forbiddenNodeKinds = new Set([
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TypeAssertionExpression,
]);

describe("CLI architecture", () => {
  it("keeps production modules focused", async () => {
    for (const path of await sourceFiles()) {
      const source = await readFile(path, "utf8");
      expect(source.split("\n").length, path).toBeLessThanOrEqual(150);
    }
  });

  it("contains no unsafe TypeScript escape hatches", async () => {
    for (const path of await sourceFiles()) {
      const source = await readFile(path, "utf8");
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const violations: number[] = [];
      const visit = (node: ts.Node): void => {
        if (forbiddenNodeKinds.has(node.kind)) violations.push(node.getStart(file));
        ts.forEachChild(node, visit);
      };
      visit(file);
      expect(violations, path).toEqual([]);
      expect(source).not.toMatch(/@ts-(?:ignore|expect-error|nocheck)/);
    }
  });
});
