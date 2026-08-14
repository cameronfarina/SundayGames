import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const facade = path.resolve("src/mockBatchResourceManager.ts");
const moduleDirectory = path.resolve("src/mockBatchResourceManager");

const lineCount = (text: string): number => text.trimEnd().split("\n").length;

const unsafeSyntax = (file: string): readonly string[] => {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

describe("mock batch resource manager architecture", () => {
  it("keeps scheduling code in focused, strictly typed modules", () => {
    expect(existsSync(moduleDirectory)).toBe(true);
    if (!existsSync(moduleDirectory)) return;
    const files = [
      facade,
      ...readdirSync(moduleDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(moduleDirectory, name)),
    ];

    for (const file of files) {
      const label = path.relative(process.cwd(), file);
      expect(lineCount(readFileSync(file, "utf8")), label).toBeLessThanOrEqual(150);
      expect(unsafeSyntax(file), label).toEqual([]);
    }
  });
});
