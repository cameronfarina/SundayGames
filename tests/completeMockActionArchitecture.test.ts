import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const facade = path.resolve("src/liveDraftServer/completeMockAction.ts");
const moduleDirectory = path.resolve("src/liveDraftServer/completeMockAction");

const unsafeSyntax = (file: string): readonly string[] => {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

describe("complete mock action architecture", () => {
  it("keeps mock completion in focused, strictly typed modules", () => {
    expect(existsSync(moduleDirectory)).toBe(true);
    if (!existsSync(moduleDirectory)) return;
    const files = [
      facade,
      ...readdirSync(moduleDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(moduleDirectory, name)),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const label = path.relative(process.cwd(), file);
      expect(source.trimEnd().split("\n").length, label).toBeLessThanOrEqual(150);
      expect(unsafeSyntax(file), label).toEqual([]);
    }
  });
});
